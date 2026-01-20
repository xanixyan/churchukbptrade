import fs from "fs";
import path from "path";
import crypto from "crypto";

// File lock tracking for concurrency control
const fileLocks = new Map<string, Promise<void>>();

/**
 * Acquire an exclusive lock on a file path.
 * Uses an in-process queue to prevent race conditions in concurrent requests.
 * Returns a release function to be called when done.
 */
export async function acquireFileLock(filePath: string): Promise<() => void> {
  // Wait for any existing lock on this file
  while (fileLocks.has(filePath)) {
    await fileLocks.get(filePath);
  }

  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  fileLocks.set(filePath, lockPromise);

  return () => {
    fileLocks.delete(filePath);
    releaseLock!();
  };
}

/**
 * Execute a function with exclusive file lock.
 * Ensures only one operation can modify the file at a time.
 */
export async function withFileLock<T>(
  filePath: string,
  fn: () => T | Promise<T>
): Promise<T> {
  const release = await acquireFileLock(filePath);
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * Safely write data to a JSON file using temp file + rename pattern.
 * This prevents file corruption if the process is interrupted during write.
 */
export function safeWriteJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Generate temp file path with random suffix
  const tempPath = `${filePath}.${crypto.randomBytes(4).toString("hex")}.tmp`;

  try {
    // Write to temp file
    const content = JSON.stringify(data, null, 2) + "\n";
    fs.writeFileSync(tempPath, content, "utf-8");

    // Atomic rename (works on same filesystem)
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Read JSON file safely
 */
export function safeReadJson<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Error reading JSON file ${filePath}:`, error);
    return null;
  }
}
