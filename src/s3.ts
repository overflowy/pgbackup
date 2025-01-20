import { config } from "@/config";
import type { BackupMetadata, S3Object } from "@/types";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

const s3Client = new S3Client({
  endpoint: config.s3Endpoint,
  credentials: {
    accessKeyId: config.s3AccessKey,
    secretAccessKey: config.s3SecretKey,
  },
  forcePathStyle: true,
  region: config.s3Region,
});

export const uploadToS3 = async (
  filePath: string,
  key: string,
  metadata: Record<string, string>
): Promise<void> => {
  const fileStream = createReadStream(filePath);

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: config.s3Bucket,
      Key: key,
      Body: fileStream,
      Metadata: metadata,
    },
  });

  await upload.done();
};

export const deleteFromS3 = async (key: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
  });

  await s3Client.send(command);
};

export const listFromS3 = async () => {
  const command = new ListObjectsV2Command({
    Bucket: config.s3Bucket,
    Prefix: `dump_${config.dbName}`,
  });

  const response = await s3Client.send(command);

  if (!response.Contents) return [] as S3Object[];

  return response.Contents as S3Object[];
};

export const getBackupMetadataFromS3 = async (key: string): Promise<BackupMetadata> => {
  const command = new HeadObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
  });

  const response = await s3Client.send(command);
  return response.Metadata as unknown as BackupMetadata;
};

export const downloadFromS3 = async (key: string, destinationPath: string): Promise<void> => {
  const command = new GetObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
  });

  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new Error("Empty response from S3");
  }

  await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(destinationPath));
};
