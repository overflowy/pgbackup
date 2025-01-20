import { listFromS3 } from "@/s3";
import type { OutputFormat } from "@/types";
import { formatBytes, formatDate } from "@/utils/format";
import Table from "cli-table3";

export const list = async (outputFormat: OutputFormat = "human") => {
  const backups = await listFromS3();

  const sortedBackups = backups
    .sort((a, b) => new Date(b.LastModified).getTime() - new Date(a.LastModified).getTime())
    .map((obj, index) => ({
      id: String(index + 1),
      date: obj.LastModified?.toISOString() || "",
      name: obj.Key || "",
      size: obj.Size || 0,
    }));

  if (outputFormat === "json") {
    if (!sortedBackups.length) {
      console.log("[]");
      return;
    }
    console.log(JSON.stringify(sortedBackups, null, 2));
    return;
  }

  if (!sortedBackups.length) {
    console.log("No backups found");
    return;
  }

  const table = new Table({
    head: ["ID", "Last Modified", "Name", "Size"],
    style: { head: ["cyan"] },
  });

  for (const backup of sortedBackups) {
    table.push([
      backup.id,
      formatDate(new Date(backup.date)),
      backup.name,
      formatBytes(backup.size),
    ]);
  }

  console.log(table.toString());
};
