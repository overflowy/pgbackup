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
  s3Region: string;
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
};

export type S3Object = {
  Key: string;
  LastModified: Date;
  Size: number;
  ETag: string;
  StorageClass: string;
};

export type OutputFormat = "human" | "json";

export type RestoreOptions = {
  force: boolean;
  drop: boolean;
};
