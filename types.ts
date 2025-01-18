export type Config = {
  dbHost: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbPort: number;
  s3Endpoint: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3Bucket: string;
  maxBackups: number;
  tempDir: string;
  operationTimeout: number;
  verifyChecksum: boolean;
};

export type BackupMetadata = {
  id: string;
  date: string;
  name: string;
  size: number;
  checksum: string;
  isValid: boolean;
};

export type RestoreOptions = {
  dryRun: boolean;
  force: boolean;
  drop: boolean;
};

export enum ExitCode {
  Success = 0,
  ConfigError = 1,
  DatabaseError = 2,
  S3Error = 3,
  OperationError = 4,
  UserInterrupt = 5,
  SystemError = 6,
}

export type OutputFormat = "human" | "json";
