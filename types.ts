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
