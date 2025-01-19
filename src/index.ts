import { handleBackup } from "@/backup";
import { listBackups } from "@/s3";

const main = async () => {
  await listBackups();
  //   await handleBackup();
};

main();
