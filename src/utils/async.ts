import { exec } from "node:child_process";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

export const execAsync = promisify(exec);

export const retry = async <T>(fn: () => Promise<T>, attempts = 3, delay = 1000): Promise<T> => {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay * 2 ** i));
    }
  }
  throw new Error("Retry failed");
};

export const confirm = async (message: string): Promise<boolean> => {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await new Promise<string>((resolve) => {
      readline.question(`${message} (y/n) `, resolve);
    });
    return answer.toLowerCase() === "y";
  } finally {
    readline.close();
  }
};
