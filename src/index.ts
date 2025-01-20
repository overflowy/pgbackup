import { backup } from "@/commands/backup";
import { list } from "@/commands/list";
import { remove } from "@/commands/remove";
import { restore } from "@/commands/restore";
import { Command } from "commander";
import { version } from "../package.json";

const main = async () => {
  const program = new Command();

  program.name("pgbackup").description("A backup tool for PostgreSQL databases").version(version);

  program
    .command("backup")
    .alias("b")
    .description("Create a new backup")
    .action(async () => {
      await backup();
    });

  program
    .command("list")
    .alias("ls")
    .alias("l")
    .description("List available backups")
    .option("--format <format>", "Output format (human|json)", "human")
    .action(async (options) => {
      await list(options.format);
    });

  program
    .command("remove")
    .alias("rm")
    .description("Remove a backup")
    .action(async (id) => {
      await remove(id);
    });

  program
    .command("restore")
    .alias("r")
    .argument("<id>", "Backup ID to restore")
    .description("Restore a backup")
    .option("--force", "Skip user confirmation")
    .option("--drop", "Drop existing objects before restore")
    .action(async (id, options) => {
      await restore(id, {
        force: options.force || false,
        drop: options.drop || false,
      });
    });

  program.parse();
};

main();
