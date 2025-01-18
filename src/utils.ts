import { exec } from "node:child_process";
import { createHash, type BinaryLike } from "node:crypto";
import { createReadStream } from "node:fs";
import { promisify } from "node:util";

export const execAsync = promisify(exec);

export const checkBinaryExists = async (binary: string): Promise<boolean> => {
  try {
    const command = process.platform === "win32" ? `where ${binary}` : `which ${binary}`;

    await execAsync(command);
    return true;
  } catch {
    return false;
  }
};

export const calculateChecksum = async (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (data: BinaryLike) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
};

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

export const formatBytes = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }

  return `${size.toFixed(2)} ${units[unit]}`;
};

export const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};
