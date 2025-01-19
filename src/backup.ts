import { config } from "@/config";
import {
  calculateChecksum,
  checkBinaryExists,
  execAsync,
  formatBytes,
  formatDuration,
} from "@/utils";
import { format } from "date-fns";
import { existsSync } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import ora from "ora";

type BackupResult = {
  success: boolean;
  duration: number;
  size: number;
  compressedSize: number;
  checksum: string;
  backupName: string;
};

export const backup = async (): Promise<BackupResult> => {
  const spinner = ora();
  const startTime = Date.now();

  try {
    spinner.start("Checking for pg_dump");
    const pgDumpExists = await checkBinaryExists("pg_dump");
    if (!pgDumpExists) {
      spinner.fail("pg_dump not found. Please install PostgreSQL client tools.");
      process.exit(1);
    }
    spinner.succeed("pg_dump found");

    const timestamp = format(new Date(), "yyyy-MM-dd-HH:mm");
    const backupName = `dump_${config.dbName}.${timestamp}.zstd`;
    if (!existsSync(config.tempDir)) {
      await mkdir(config.tempDir, { recursive: true });
    }
    const backupPath = `${config.tempDir}/${backupName}`;

    process.env.PGPASSWORD = config.dbPassword;

    spinner.start("Creating database backup");
    try {
      await execAsync(
        `pg_dump -h ${config.dbHost} -p ${config.dbPort} ` +
          `-U ${config.dbUser} -d ${config.dbName} ` +
          `-Fc --compress=zstd:3 -f ${backupPath}`
      );
    } catch (error) {
      spinner.fail("Database backup failed");
      console.error("pg_dump error:", error);
      process.exit(1);
    }
    spinner.succeed("Database backup created");

    spinner.start("Calculating database size");
    let dbSize: number;
    try {
      const { stdout } = await execAsync(
        `psql -h ${config.dbHost} -p ${config.dbPort} ` +
          `-U ${config.dbUser} -d ${config.dbName} -t -c ` +
          `"SELECT pg_database_size('${config.dbName}')"`
      );
      dbSize = Number.parseInt(stdout.trim(), 10);
    } catch (error) {
      spinner.warn("Could not determine database size");
      dbSize = 0;
    }

    spinner.start("Processing backup");
    const backupStats = await stat(backupPath);
    const checksum = await calculateChecksum(backupPath);
    spinner.succeed("Backup processed");

    spinner.start("Cleaning up temporary files");
    await unlink(backupPath);
    spinner.succeed("Cleanup completed");

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log("\nBackup Summary:");
    console.log("==============");
    console.log(`Original DB Size: ${formatBytes(dbSize)}`);
    console.log(`Backup Size: ${formatBytes(backupStats.size)}`);
    console.log(`Compression Ratio: ${(dbSize / backupStats.size || 0).toFixed(2)}x`);
    console.log(`Duration: ${formatDuration(duration)}`);
    console.log(`Checksum: ${checksum}`);

    return {
      success: true,
      duration,
      size: dbSize,
      compressedSize: backupStats.size,
      checksum,
      backupName,
    };
  } catch (error) {
    spinner.fail("Backup process failed");
    console.error("Unexpected error:", error);
    process.exit(1);
  }
};
