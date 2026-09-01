import { accessSync, constants as fsConstants } from "node:fs";
import { spawnSync } from "node:child_process";

import { chromium, type Browser, type Page } from "playwright";

const DEFAULT_BROWSER_TIMEOUT_MS = 45_000;

function executableCandidate(candidate: string): string | null {
  if (candidate.includes("/")) {
    try {
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      return null;
    }
  }

  const result = spawnSync("which", [candidate], { encoding: "utf8" });
  if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  return null;
}

export function findArticleBrowserExecutable(): string | null {
  const candidates = [
    process.env.ARTICLE_BROWSER_EXECUTABLE?.trim(),
    process.env.CHROME_BIN?.trim(),
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "google-chrome",
    "chromium",
    "chromium-browser"
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const executable = executableCandidate(candidate);
    if (executable) return executable;
  }
  return null;
}

export async function launchArticleBrowser(): Promise<{ browser: Browser; executable: string }> {
  const executable = findArticleBrowserExecutable();
  if (!executable) {
    throw new Error(
      "Rendered article QA requires an executable Chrome/Chromium browser. Set ARTICLE_BROWSER_EXECUTABLE or install google-chrome."
    );
  }

  try {
    const browser = await chromium.launch({
      headless: true,
      executablePath: executable,
      timeout: DEFAULT_BROWSER_TIMEOUT_MS,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    return { browser, executable };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Headless Chrome could not start at ${executable}: ${reason}`);
  }
}

export async function runArticleBrowserSmokeTest(): Promise<string> {
  const { browser, executable } = await launchArticleBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body><main id=smoke>article browser ready</main></body></html>");
    const text = await page.locator("#smoke").innerText();
    if (text !== "article browser ready") throw new Error("Headless browser smoke page did not render expected text.");
    return executable;
  } finally {
    await browser.close();
  }
}

type RenderedImage = {
  src: string;
  currentSrc: string;
  alt: string;
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
};

export type RenderedArticleCheck = {
  url: string;
  title: string;
  expectedImageSources?: string[];
  expectedYouTubeIds?: string[];
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function imagePath(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return value.split(/[?#]/, 1)[0] ?? value;
  }
}

function imageMatches(expected: string, rendered: RenderedImage): boolean {
  const expectedPath = imagePath(expected);
  const renderedPath = imagePath(rendered.currentSrc || rendered.src);
  return Boolean(expectedPath) && (renderedPath === expectedPath || renderedPath.endsWith(expectedPath));
}

async function scrollArticle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
    const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    for (let top = 0; top <= height; top += step) {
      window.scrollTo(0, top);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    window.scrollTo(0, 0);
  });
}

async function readArticleImages(page: Page): Promise<RenderedImage[]> {
  let images: RenderedImage[] = [];
  for (let attempt = 0; attempt < 120; attempt += 1) {
    images = await page.locator("#article-body img").evaluateAll((elements) =>
      elements.map((element) => {
        const image = element as HTMLImageElement;
        return {
          src: image.getAttribute("src") ?? "",
          currentSrc: image.currentSrc ?? "",
          alt: image.alt ?? "",
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight
        };
      })
    );
    if (images.every((image) => image.complete)) return images;
    await page.waitForTimeout(250);
  }
  return images;
}

export async function assertRenderedArticle(page: Page, check: RenderedArticleCheck): Promise<void> {
  const response = await page.goto(check.url, {
    waitUntil: "domcontentloaded",
    timeout: DEFAULT_BROWSER_TIMEOUT_MS
  });
  if (!response) throw new Error(`${check.url} did not return a browser response.`);
  if (response.status() !== 200) throw new Error(`${check.url} returned HTTP ${response.status()}.`);

  await page.locator("h1").first().waitFor({ state: "visible", timeout: DEFAULT_BROWSER_TIMEOUT_MS });
  await page.locator("#article-body").waitFor({ state: "attached", timeout: DEFAULT_BROWSER_TIMEOUT_MS });

  const heading = normalizeText(await page.locator("h1").first().innerText());
  if (heading !== normalizeText(check.title)) {
    throw new Error(`${check.url} rendered the wrong title: expected "${check.title}", got "${heading}".`);
  }

  const articleText = normalizeText(await page.locator("#article-body").innerText());
  if (!articleText) throw new Error(`${check.url} rendered an empty article body.`);

  const visibleText = await page.locator("body").innerText();
  if (/application error|unhandled runtime error|internal server error/i.test(visibleText)) {
    throw new Error(`${check.url} rendered a visible application error.`);
  }

  await scrollArticle(page);
  const images = await readArticleImages(page);
  const brokenImages = images.filter(
    (image) => !image.complete || !image.src || image.naturalWidth <= 0 || image.naturalHeight <= 0
  );
  if (brokenImages.length) {
    const labels = brokenImages.map((image) => image.src || "missing src").join(", ");
    throw new Error(`${check.url} has ${brokenImages.length} unloaded article image(s): ${labels}`);
  }

  for (const expected of check.expectedImageSources ?? []) {
    if (!images.some((image) => imageMatches(expected, image))) {
      throw new Error(`${check.url} is missing rendered article image ${expected}.`);
    }
  }

  if (check.expectedYouTubeIds?.length) {
    const iframeSources = await page.locator("#article-body iframe").evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("src") ?? "")
    );
    for (const videoId of check.expectedYouTubeIds) {
      if (!iframeSources.some((src) => src.includes(`youtube-nocookie.com/embed/${videoId}`))) {
        throw new Error(`${check.url} is missing rendered YouTube embed ${videoId}.`);
      }
    }
  }
}
