import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { launchArticleBrowser } from "../content/article-browser";
export function inspectionPath(workspace: string, url: string) {
  return path.join(workspace, "image-inspection", `${createHash("sha256").update(url).digest("hex").slice(0, 24)}.png`);
}
export async function inspectArticleImage(url: string, workspace: string) {
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Image inspection requires an HTTP(S) source URL.");
  const output = inspectionPath(workspace, url);
  await mkdir(path.dirname(output), { recursive: true });
  const { browser } = await launchArticleBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const response = await page.goto(url, { waitUntil: "load", timeout: 45_000 });
    if (!response?.ok()) throw new Error(`Image source failed: HTTP ${response?.status()}`);
    await page.screenshot({ path: output });
    return output;
  } finally { await browser.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [url, workspace] = process.argv.slice(2);
  if (!url || !workspace || process.argv.length !== 4) throw new Error("Usage: articles:inspect-image -- <source-image-url> <article-workspace>");
  inspectArticleImage(url, path.resolve(workspace)).then(output => console.log(JSON.stringify({ source: url, screenshot: output, instruction: "Open screenshot with view_image; a successful screenshot is not proof of an exact gameplay match." }))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
