import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nodeEnv = process.env.NODE_ENV ?? "development";
const localWriterOnly = process.env.ARTICLE_WRITER_LOCAL_ONLY === "true";

const candidates = (localWriterOnly
  ? [`.env.${nodeEnv}.local`, ".env.local"]
  : [
      `.env.${nodeEnv}.local`,
      nodeEnv === "test" || nodeEnv === "production" ? null : ".env.local",
      `.env.${nodeEnv}`,
      ".env"
    ]
).filter((value): value is string => Boolean(value));

for (const relativePath of candidates) {
  const envPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(envPath)) continue;

  loadDotenv({
    path: envPath,
    override: false,
    quiet: true
  });
}
