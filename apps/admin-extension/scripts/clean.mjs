import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await rm(path.join(appDir, "dist"), { recursive: true, force: true });
