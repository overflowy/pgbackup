import { backup } from "@/commands/backup";
import { list } from "@/commands/list";

const main = async () => {
  await list();
  await backup();
  await list();
};

main();
