import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appDir, "../..");
const distDir = path.join(appDir, "dist");
const iconSource = path.join(repoRoot, "apps/web/public/android-chrome-192x192.png");
const iconDir = path.join(distDir, "icons");
const brandDir = path.join(distDir, "brand");
const manifestPath = path.join(appDir, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

await mkdir(iconDir, { recursive: true });
await mkdir(brandDir, { recursive: true });

await copyFile(manifestPath, path.join(distDir, "manifest.json"));
await copyFile(path.join(appDir, "styles.css"), path.join(distDir, "styles.css"));
await copyFile(path.join(appDir, "popup.html"), path.join(distDir, "popup.html"));
await copyFile(path.join(appDir, "popup.css"), path.join(distDir, "popup.css"));
await copyFile(path.join(repoRoot, "apps/web/public/Bloxodes-dark.png"), path.join(brandDir, "Bloxodes-dark.png"));
await copyFile(path.join(repoRoot, "apps/web/public/Bloxodes-light.png"), path.join(brandDir, "Bloxodes-light.png"));

for (const size of [16, 32, 48, 128]) {
  await sharp(iconSource)
    .resize(size, size)
    .png()
    .toFile(path.join(iconDir, `icon${size}.png`));
}

const filesToCheck = [
  "manifest.json",
  "background.js",
  "content.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "styles.css"
];
for (const file of filesToCheck) {
  await readFile(path.join(distDir, file), "utf8");
}

await writeFile(
  path.join(distDir, "README.txt"),
  [
    `Bloxodes Browser Extension v${manifest.version}`,
    "",
    "This Chromium extension package can be submitted to the Chrome Web Store or Microsoft Edge Add-ons.",
    "Shows active code previews and seven-day player history on Roblox game pages.",
    "Use the toolbar popup to enable or disable either widget."
  ].join("\n")
);
