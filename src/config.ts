import type { Config } from "@/types";
import { config as dotenvConfig } from "dotenv";

const loadConfig = (): Config => {
  dotenvConfig();

  const required = [
    "DB_HOST",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "S3_ENDPOINT",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "S3_BUCKET",
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error("Missing required environment variables:", missing.join(", "));
    process.exit(1);
  }

  return {
    dbHost: process.env.DB_HOST || "",
    dbName: process.env.DB_NAME || "",
    dbUser: process.env.DB_USER || "",
    dbPassword: process.env.DB_PASSWORD || "",
    dbPort: Number.parseInt(process.env.DB_PORT || "5432"),
    s3Endpoint: process.env.S3_ENDPOINT || "",
    s3AccessKey: process.env.S3_ACCESS_KEY || "",
    s3SecretKey: process.env.S3_SECRET_KEY || "",
    s3Bucket: process.env.S3_BUCKET || "",
    maxBackups: Number.parseInt(process.env.MAX_BACKUPS || "5"),
    tempDir: process.env.TEMP_DIR || process.cwd(),
    operationTimeout: Number.parseInt(process.env.OPERATION_TIMEOUT || "3600"),
    verifyChecksum: process.env.VERIFY_CHECKSUM !== "false",
  };
};

export const config = loadConfig();
