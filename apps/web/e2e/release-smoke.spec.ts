import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from 'node:path';
import {assertRenderedArticle} from '../../../scripts/content/article-browser';
import {findMarkdownImages,findYouTubeDirectives} from '../src/lib/article-media';
import {extractArticleBlockImageRefs} from '../src/lib/article-blocks';

const managedBatch=process.env.BLOXODES_MANAGED_QA==='true' && process.env.BATCH ? JSON.parse(fs.readFileSync(process.env.BATCH,'utf8')) : null;

const selected: Array<{path: string; contains?: string}> = process.env.RELEASE_SMOKE_BATCH
  ? JSON.parse(fs.readFileSync(process.env.RELEASE_SMOKE_BATCH, "utf8")).urls
  : (process.env.RELEASE_SMOKE_PATHS?.split(",").filter(Boolean) ?? ["/", "/games", "/wiki", "/tools"]).map(path => ({path}));
for (const {path: pathname, contains} of selected.slice(0, 20)) {
  test(`${pathname} renders and fits the screen`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto(pathname, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    if (contains) await expect(page.locator("main")).toContainText(contains, { ignoreCase: true });
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page).toHaveTitle(/\S/);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBeTruthy();
    const canonicalUrl = new URL(canonical!);
    expect(canonicalUrl.origin).toBe("https://bloxodes.com");
    expect(canonicalUrl.pathname.replace(/\/+$/, "") || "/").toBe(pathname);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    const article=managedBatch?.operations.find((operation:any)=>operation.publisher==='article-queue' && JSON.parse(fs.readFileSync(path.join(path.dirname(process.env.BATCH!),operation.file),'utf8')).slug===pathname.split('/').pop());
    if(article) {
      const final=JSON.parse(fs.readFileSync(path.join(path.dirname(process.env.BATCH!),article.file),'utf8'));
      await assertRenderedArticle(page,{url:new URL(pathname,page.url()).href,title:final.title,
        expectedImageSources:[...findMarkdownImages(final.content_md),...extractArticleBlockImageRefs(final.content_md)].map(image=>image.src),
        expectedYouTubeIds:findYouTubeDirectives(final.content_md).map(directive=>directive.videoId).filter((id):id is string=>Boolean(id))});
    }
    await page.screenshot({ path: info.outputPath("page.png"), fullPage: true });
  });
}
