import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";

// Python's standard library exposes flock on both Linux and macOS. The child
// locks a duplicate of our open descriptor. Our descriptor keeps that lock
// after the child exits, and the kernel releases it if this process dies.
export async function acquireAdvisoryFileLock(file: string): Promise<() => Promise<void>> {
  if (!["linux", "darwin"].includes(process.platform)) throw new Error("Advisory file locking requires Linux or macOS.");
  const handle = await fs.open(file, "a+", 0o600);
  try {
    const result = spawnSync("python3", ["-I", "-c", [
      "import errno, fcntl, sys",
      "try:",
      "    fcntl.flock(3, fcntl.LOCK_EX | fcntl.LOCK_NB)",
      "except OSError as error:",
      "    sys.exit(75 if error.errno in (errno.EACCES, errno.EAGAIN) else 1)",
    ].join("\n")], { stdio: ["ignore", "pipe", "pipe", handle.fd], timeout: 5000, maxBuffer: 4096 });
    if (result.status === 75) throw new Error("Article discovery state is busy.");
    if (result.error || result.status !== 0) throw new Error("Advisory file locking failed. Python 3 with fcntl.flock is required; acquisition must finish within 5 seconds.");
    // Never unlink the lock file. Every contender must lock the same inode.
    return () => handle.close();
  } catch (error) {
    await handle.close();
    throw error;
  }
}
