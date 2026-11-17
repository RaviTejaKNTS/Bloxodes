import fs from "node:fs/promises";
import path from "node:path";
import { mapPublishConcurrent } from "./publish-network.mjs";
import { loadR2ClientConfig, R2Client } from "./r2-client";

export function imageFilename(key: string) {
  const filename = key.split("/").pop()?.trim();
  if (!filename || filename === "." || filename === "..") throw new Error(`Invalid database image key: ${key}`);
  return filename;
}

export async function exportCollectionMedia(
  keys: readonly string[],
  mediaRoot: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
) {
  // Require credentials before creating files; never route exports through the public Worker.
  const r2 = new R2Client(loadR2ClientConfig(env), fetchImpl);
  await fs.mkdir(mediaRoot, { recursive: true });
  await mapPublishConcurrent(keys, async (key) => {
    const bytes = await r2.getObject(key);
    await fs.writeFile(path.join(mediaRoot, imageFilename(key)), bytes);
  }, { label: "Exported R2 media" });
}
