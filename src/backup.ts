import { config } from "@/config";
import { uploadToS3 } from "@/s3";
import {
  calculateChecksum,
  checkBinaryExists,
  cleanupFile,
  ensureTempDir,
  execAsync,
  formatBytes,
  formatDuration,
} from "@/utils";
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
  const spinner = ora();
  const startTime = Date.now();
  let backupPath: string | undefined;

  try {
    await ensureTempDir(config.tempDir);
    spinner.start("Checking for pg_dump");
    const pgDumpExists = await checkBinaryExists("pg_dump");
    if (!pgDumpExists) {
      spinner.fail("pg_dump not found. Please install PostgreSQL client tools.");
      process.exit(0);
    }
    spinner.succeed("pg_dump found");

    spinner.start("Checking for psql");
    const psqlExists = await checkBinaryExists("psql");
    if (!psqlExists) {
      spinner.warn("psql not found. Original database size calculation will be skipped.");
    }

    const timestamp = format(new Date(), "yyyy-MM-dd-HH:mm");
    const backupName = `dump_${config.dbName}.${timestamp}.zstd`;
    backupPath = join(config.tempDir, backupName);

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
      throw new Error("Database backup failed");
    }
    spinner.succeed("Database backup created");

    let dbSize: number | undefined;
    if (psqlExists) {
      spinner.start("Calculating database size");
      try {
        const { stdout } = await execAsync(
          `psql -h ${config.dbHost} -p ${config.dbPort} ` +
            `-U ${config.dbUser} -d ${config.dbName} -t -c ` +
            `"SELECT pg_database_size('${config.dbName}')"`
        );
        dbSize = Number.parseInt(stdout.trim(), 10);
        spinner.succeed("Database size calculated");
      } catch (error) {
        spinner.info("Could not determine database size");
      }
    }

    spinner.start("Processing backup");
    const backupStats = await stat(backupPath);
    const checksum = await calculateChecksum(backupPath);
    spinner.succeed("Backup processed");

    spinner.start("Uploading to S3");
    try {
      await uploadToS3(backupPath, backupName, {
        checksum,
        timestamp,
        ...(dbSize && { originalSize: String(dbSize) }),
        compressedSize: String(backupStats.size),
      });
    } catch (error) {
      spinner.fail("Upload failed");
      console.error("S3 upload error:", error);
      throw new Error("S3 upload failed");
    }
    spinner.succeed("Upload completed");

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
  } catch (error) {
    spinner.fail("Backup process failed");
    console.error("Unexpected error:", error);
    throw error;
  } finally {
    if (backupPath) {
      spinner.start("Cleaning up temporary files");
      await cleanupFile(backupPath);
      spinner.succeed("Cleanup completed");
    }
  }
};

export const handleBackup = async (): Promise<void> => {
  try {
    await backup();
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Database backup failed")) {
        process.exit(1);
      } else if (error.message.includes("S3 upload failed")) {
        process.exit(1);
      }
    }
    process.exit(1);
  }
};
