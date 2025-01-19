import { config } from "@/config";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream } from "node:fs";

const s3Client = new S3Client({
  endpoint: config.s3Endpoint,
  credentials: {
    accessKeyId: config.s3AccessKey,
    secretAccessKey: config.s3SecretKey,
  },
  forcePathStyle: true,
  region: "us-east-1",
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
