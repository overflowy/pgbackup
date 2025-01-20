import { listBackups } from "@/commands/list";
import { deleteFromS3 } from "@/s3";

export const remove = async (id: string): Promise<void> => {
  const backups = await listBackups();

  const backup = backups.find((backup) => backup.id === id);
  if (!backup) {
    console.error(`Backup with ID ${id} not found`);
    return;
  }

  await deleteFromS3(backup.name);
  console.log(`Backup with ID ${id} removed`);
};
