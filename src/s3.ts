import { config } from "@/config";
import type { BackupMetadata, OutputFormat } from "@/types";
import { formatBytes, formatDate } from "@/utils";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import Table from "cli-table3";
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

export const listBackups = async (format: OutputFormat = "human"): Promise<void> => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: config.s3Bucket,
      Prefix: `dump_${config.dbName}`,
    });

    const response = await s3Client.send(command);

    if (!response.Contents) {
      if (format === "json") {
        console.log(JSON.stringify([]));
        return;
      }
      console.log("No backups found");
      return;
    }

    const backups = response.Contents.map((obj, index) => ({
      id: String(index + 1),
      date: obj.LastModified?.toISOString() || "",
      name: obj.Key || "",
      size: obj.Size || 0,
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (format === "json") {
      console.log(JSON.stringify(backups, null, 2));
      return;
    }

    const table = new Table({
      head: ["ID", "Date", "Name", "Size"],
      style: { head: ["cyan"] },
    });

    for (const backup of backups) {
      table.push([
        backup.id,
        formatDate(new Date(backup.date)),
        backup.name,
        formatBytes(backup.size),
      ]);
    }

    console.log(table.toString());
  } catch (error) {
    console.error("Failed to list backups:", error);
    process.exit(1);
  }
};
