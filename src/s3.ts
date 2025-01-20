import { config } from "@/config";
import type { BackupMetadata, OutputFormat } from "@/types";
import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream } from "node:fs";

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
  if (!response.Contents) return [];

  return response.Contents;
};
