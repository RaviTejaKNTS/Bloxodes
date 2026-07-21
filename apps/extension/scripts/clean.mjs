import { readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await rm(path.join(appDir, "dist"), { recursive: true, force: true });

const generatedArchives = (await readdir(appDir)).filter((name) => /^bloxodes-extension-v[0-9.]+\.zip$/.test(name));
await Promise.all(generatedArchives.map((name) => rm(path.join(appDir, name), { force: true })));
