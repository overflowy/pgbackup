import { listBackups } from "@/commands/list";
import { config } from "@/config";
import { deleteFromS3, uploadToS3 } from "@/s3";
import { execAsync, retry } from "@/utils/async";
import { formatBytes, formatDuration } from "@/utils/format";
import { calcSha256, checkBinaryExists, ensureDir, tryRemoveFile } from "@/utils/os";
import { safe } from "@/utils/safe";
import { format } from "date-fns";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import ora from "ora";

type BackupResult = {
  success: boolean;
  duration: number;
  size?: number;
  compressedSize?: number;
  checksum: string;
  backupName: string;
};

export const backup = async (): Promise<BackupResult> => {
  process.env.PGPASSWORD = config.dbPassword;

  const spinner = ora();
  const startTime = Date.now();
  const timestamp = format(new Date(), "yyyy-MM-dd-HH:mm");
  const backupName = `dump_${config.dbName}.${timestamp}.zstd`;
  const backupPath = join(config.tempDir, backupName);

  const handleInterrupt = async () => {
    spinner.stop();
    console.warn("\nReceived interrupt signal. Cleaning up...");
    await tryRemoveFile(backupPath);
    process.exit(1);
  };
  process.on("SIGINT", handleInterrupt);
  process.on("SIGTERM", handleInterrupt);

  const tempDirReady = await safe(
    ensureDir(config.tempDir),
    "Failed to access or create temp directory"
  );
  if (!tempDirReady.ok) {
    spinner.fail(tempDirReady.error);
    process.exit(1);
  }

  spinner.start("Checking for psql");
  const psqlExists = await safe(checkBinaryExists("psql"));
  if (!psqlExists.ok) {
    spinner.warn("psql not found, database size will not be calculated");
  }

  spinner.start("Checking for pg_dump");
  const pgDumpExists = await safe(checkBinaryExists("pg_dump"));
  if (!pgDumpExists.ok) {
    spinner.fail("pg_dump not found");
    process.exit(1);
  }

  spinner.start("Creating database backup");
  const pgDumpResult = await safe(
    execAsync(
      [
        "pg_dump",
        "-h",
        config.dbHost,
        "-p",
        config.dbPort,
        "-U",
        config.dbUser,
        "-d",
        config.dbName,
        "-Fc",
        "--compress=zstd:3",
        "-f",
        backupPath,
      ].join(" ")
    )
  );

  if (!pgDumpResult.ok) {
    spinner.fail(`Failed to create database backup:\n${pgDumpResult.error}`);
    await tryRemoveFile(backupPath);
    process.exit(1);
  }
  spinner.succeed("Database backup created");

  spinner.start("Calculating database size");
  let dbSize: number | undefined;
  if (psqlExists.ok) {
    const psqlCmd = await safe(
      execAsync(
        [
          "psql",
          "-h",
          config.dbHost,
          "-p",
          config.dbPort,
          "-U",
          config.dbUser,
          "-d",
          config.dbName,
          "-t",
          "-c",
          `"SELECT pg_database_size('${config.dbName}')"`,
        ].join(" ")
      )
    );

    if (psqlCmd.ok) {
      const { stdout } = psqlCmd.data;
      dbSize = Number.parseInt(stdout.trim(), 10);
      spinner.succeed("Database size calculated");
    } else {
      spinner.info("Could not determine database size");
    }
  }

  spinner.start("Processing backup");
  const backupStats = await stat(backupPath);
  const checksum = await calcSha256(backupPath);
  spinner.succeed("Backup processed");

  spinner.start("Uploading backup");
  const uploadResult = await safe(
    retry(() =>
      uploadToS3(backupPath, backupName, {
        checksum,
        timestamp,
        ...(dbSize && { originalSize: String(dbSize) }),
        compressedSize: String(backupStats.size),
      })
    )
  );
  if (!uploadResult.ok) {
    spinner.fail(`Failed to upload backup:\n${uploadResult.error}`);
    await tryRemoveFile(backupPath);
    process.exit(1);
  }
  spinner.succeed("Upload completed");

  spinner.start(`Rotating backups (MAX_BACKUPS=${config.maxBackups})`);
  const rotateResult = await safe(rotateBackups());
  if (!rotateResult.ok) {
    spinner.fail(`Failed to rotate backups:\n${rotateResult.error}`);
    await tryRemoveFile(backupPath);
    process.exit(1);
  }
  spinner.succeed("Backup rotation completed");

  await tryRemoveFile(backupPath);

  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log("\nBackup Summary:");
  console.log("===============");
  if (dbSize !== undefined) {
    console.log(`DB Size: ${formatBytes(dbSize)}`);
    console.log(`Compression Ratio: ${(dbSize / backupStats.size).toFixed(2)}x`);
  }
  console.log(`Backup Size: ${formatBytes(backupStats.size)}`);
  console.log(`Duration: ${formatDuration(duration)}`);
  console.log(`Checksum: ${checksum}`);

  return {
    success: true,
    duration,
    compressedSize: backupStats.size,
    checksum,
    backupName,
    ...(dbSize !== undefined && { size: dbSize }),
  };
};

export const rotateBackups = async (): Promise<void> => {
  const sortedBackups = await listBackups();

  if (sortedBackups.length > config.maxBackups) {
    const backupsToDelete = sortedBackups.slice(config.maxBackups);

    for (const backup of backupsToDelete) {
      await deleteFromS3(backup.name);
    }
  }
};
