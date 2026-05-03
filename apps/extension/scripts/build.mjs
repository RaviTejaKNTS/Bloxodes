import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appDir, "../..");
const distDir = path.join(appDir, "dist");
const iconSource = path.join(repoRoot, "apps/web/public/android-chrome-192x192.png");
const iconDir = path.join(distDir, "icons");

await mkdir(iconDir, { recursive: true });

await copyFile(path.join(appDir, "manifest.json"), path.join(distDir, "manifest.json"));
await copyFile(path.join(appDir, "styles.css"), path.join(distDir, "styles.css"));

for (const size of [16, 32, 48, 128]) {
  await sharp(iconSource)
    .resize(size, size)
    .png()
    .toFile(path.join(iconDir, `icon${size}.png`));
}

const filesToCheck = ["manifest.json", "background.js", "content.js", "styles.css"];
for (const file of filesToCheck) {
  await readFile(path.join(distDir, file), "utf8");
}

await writeFile(
  path.join(distDir, "README.txt"),
  [
    "Bloxodes Chrome Extension v4.0.0",
    "",
    "Upload the contents of this dist directory to the existing Chrome Web Store item.",
    "Only the first three active codes are shown on Roblox game pages.",
    "The full list opens on Bloxodes.com."
  ].join("\n")
);
