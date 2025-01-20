import { listBackups } from "@/commands/list";
import { config } from "@/config";
import { downloadFromS3, getBackupMetadataFromS3 } from "@/s3";
import type { RestoreOptions } from "@/types";
import { confirm, execAsync, retry } from "@/utils/async";
import { calcSha256, checkBinaryExists, tryRemoveFile } from "@/utils/os";
import { safe } from "@/utils/safe";
import { join } from "node:path";
import ora from "ora";

export const restore = async (id: string, options: RestoreOptions): Promise<void> => {
  process.env.PGPASSWORD = config.dbPassword;

  const spinner = ora();
  let tempFile: string | undefined;

  const handleInterrupt = async () => {
    spinner.stop();
    console.warn("\nReceived interrupt signal. Cleaning up...");
    if (tempFile) {
      await tryRemoveFile(tempFile);
    }
    process.exit(1);
  };
  process.on("SIGINT", handleInterrupt);
  process.on("SIGTERM", handleInterrupt);

  spinner.start("Checking for pg_restore");
  const pgRestoreExists = await safe(checkBinaryExists("pg_restore"));
  if (!pgRestoreExists.ok) {
    spinner.fail("pg_restore not found");
    process.exit(1);
  }
  spinner.succeed("pg_restore found");

  spinner.start("Fetching backup list");
  const backups = await safe(listBackups());
  if (!backups.ok) {
    spinner.fail("Failed to fetch backup list");
    process.exit(1);
  }
  spinner.succeed("Backup list fetched");

  const backup = backups.data.find((b) => b.id === id);
  if (!backup) {
    spinner.fail(`Backup with ID ${id} not found`);
    process.exit(1);
  }
  spinner.succeed(`Backup with ID ${id} found`);

  spinner.start("Checking database connection");
  const connectionCheck = await safe(
    execAsync(
      [
        "psql",
        "-h",
        config.dbHost,
        "-p",
        config.dbPort,
        "-U",
        config.dbUser,
        "-l", // Lists all databases
      ].join(" ")
    )
  );
  if (!connectionCheck.ok) {
    spinner.fail("Failed to connect to Postgres");
    process.exit(1);
  }
  spinner.succeed("Connection to Postgres successful");

  spinner.start("Downloading backup");
  tempFile = join(config.tempDir, backup.name);
  const success = await safe(retry(() => downloadFromS3(backup.name, tempFile)));
  if (!success.ok) {
    spinner.fail("Failed to download backup");
    process.exit(1);
  }
  spinner.succeed("Backup downloaded");

  spinner.start("Calculating checksum of the downloaded backup");
  const downloadedChecksum = await calcSha256(tempFile);
  spinner.succeed(`Checksum calculated: ${downloadedChecksum}`);

  spinner.start("Fetching original checksum from backup metadata");
  const metadata = await safe(getBackupMetadataFromS3(backup.name));
  if (!metadata.ok) {
    spinner.fail("Failed to fetch backup metadata");
    process.exit(1);
  }
  const originalChecksum = metadata.data.checksum;
  spinner.succeed(`Original checksum: ${originalChecksum}`);

  if (downloadedChecksum !== originalChecksum) {
    spinner.fail("Checksum mismatch! The downloaded backup file may be corrupted.");
    await tryRemoveFile(tempFile);
    process.exit(1);
  }
  spinner.succeed("Checksum verification successful");

  if (!options.force) {
    const confirmed = await confirm(
      `Are you sure you want to restore backup ${backup.name}? This will overwrite the current database.`
    );
    if (!confirmed) {
      console.log("Operation cancelled");
      process.exit(0);
    }
  }

  spinner.start("Restoring database");
  const restoreCmd = [
    `PGPASSWORD=${config.dbPassword} pg_restore`,
    `-h ${config.dbHost}`,
    `-p ${config.dbPort}`,
    `-U ${config.dbUser}`,
    `-d ${config.dbName}`,
    options.drop ? "--clean --if-exists" : "",
    tempFile,
  ].join(" ");

  const restoreResult = await safe(execAsync(restoreCmd));
  if (!restoreResult.ok) {
    spinner.fail(`Failed to restore database:\n${restoreResult.error}`);
    await tryRemoveFile(tempFile);
    process.exit(1);
  }
  spinner.succeed("Database restored");

  await tryRemoveFile(tempFile);
};
