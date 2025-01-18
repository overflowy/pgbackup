import { backup } from "@/backup";

const main = async () => {
  const result = await backup();
  if (result.success) {
    process.exit(0);
  } else {
    process.exit(1);
  }
};

main();
