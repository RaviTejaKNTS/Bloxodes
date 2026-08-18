import { copyFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appDir, "../..");
const distDir = path.join(appDir, "dist");
const iconDir = path.join(distDir, "icons");
const iconSource = path.join(repoRoot, "apps/web/public/android-chrome-192x192.png");

await mkdir(iconDir, { recursive: true });

for (const file of ["manifest.json", "popup.html", "edit.html", "ui.css"]) {
  await copyFile(path.join(appDir, file), path.join(distDir, file));
}

for (const size of [16, 32, 48, 128]) {
  await sharp(iconSource).resize(size, size).png().toFile(path.join(iconDir, `icon${size}.png`));
}

for (const file of ["manifest.json", "popup.html", "edit.html", "ui.css", "popup.js", "edit.js", "shared.js"]) {
  await readFile(path.join(distDir, file), "utf8");
}

console.log(`Built ${distDir}`);
