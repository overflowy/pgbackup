import { backup } from "@/commands/backup";
import { list } from "@/commands/list";
import { remove } from "@/commands/remove";

const main = async () => {
  await backup();
};

main();
