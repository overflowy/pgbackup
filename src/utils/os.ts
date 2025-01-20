import { execAsync } from "@/utils/async";
import { createHash, type BinaryLike } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, unlink } from "node:fs/promises";

export const ensureDir = async (path: string): Promise<void> => {
  try {
    await access(path);
    return;
  } catch (e) {
    // Do nothing
  }
  await mkdir(path, { recursive: true });
};

export const tryRemoveFile = async (filePath: string): Promise<void> => {
  try {
    await access(filePath);
  } catch (e) {
    // Do nothing
    return;
  }
  await unlink(filePath);
};

export const checkBinaryExists = async (binary: string): Promise<void> => {
  const command = process.platform === "win32" ? `where ${binary}` : `which ${binary}`;
  await execAsync(command);
};

export const calcSha256 = async (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (data: BinaryLike) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
};
