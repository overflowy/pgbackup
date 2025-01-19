import { config } from "@/config";
import { retry } from "@/utils";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";

const s3Client = new S3Client({
  endpoint: config.s3Endpoint,
  credentials: {
    accessKeyId: config.s3AccessKey,
    secretAccessKey: config.s3SecretKey,
  },
  forcePathStyle: true,
});

export const uploadToS3 = async (
  filePath: string,
  key: string,
  metadata: Record<string, string>
) => {
  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
    Body: createReadStream(filePath),
    Metadata: metadata,
  });

  return retry(() => s3Client.send(command));
};
