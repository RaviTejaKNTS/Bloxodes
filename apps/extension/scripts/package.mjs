import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(appDir, "dist");
const archivePath = path.join(appDir, "bloxodes-extension-v4.0.0.zip");

await access(path.join(distDir, "manifest.json"));

await new Promise((resolve, reject) => {
  const child = spawn("zip", ["-qr", archivePath, "."], {
    cwd: distDir,
    stdio: "inherit"
  });
  child.on("error", reject);
  child.on("exit", (code) => {
    if (code === 0) {
      resolve(undefined);
      return;
    }
    reject(new Error(`zip exited with code ${code}`));
  });
});

console.log(`Created ${archivePath}`);
