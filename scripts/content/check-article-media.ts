import { access } from "node:fs/promises";
import path from "node:path";

import {
  articlePublicDir,
  classifyArticleImageSrc,
  findMarkdownImages,
  findRawHtmlArticleImages,
  findYouTubeDirectives,
  type MarkdownImageRef,
} from "@/lib/article-media";

export type ArticleMediaInput = {
  slug: string;
  content_md: string;
  cover_image?: string | null;
  /** Absolute or cwd-relative path to final.json, used only for error labels */
  label?: string;
  /**
   * When true (default), local /articles/<slug>/… files must exist under apps/web/public.
   * Set false for dry structural checks only.
   */
  requireLocalFiles?: boolean;
  /**
   * When true, every body image must have non-empty alt text.
   * Default true.
   */
  requireImageAlt?: boolean;
};

export type ArticleMediaFinding = {
  level: "error" | "warning";
  rule: string;
  message: string;
};

const REPO_PUBLIC_ROOT = path.resolve(process.cwd(), "apps/web/public");

function labelOf(input: ArticleMediaInput): string {
  return input.label ?? input.slug;
}

async function localFileExists(publicPath: string): Promise<boolean> {
  const relative = publicPath.replace(/^\/+/, "");
  const absolute = path.resolve(REPO_PUBLIC_ROOT, relative);
  if (absolute !== REPO_PUBLIC_ROOT && !absolute.startsWith(`${REPO_PUBLIC_ROOT}${path.sep}`)) {
    return false;
  }
  try {
    await access(absolute);
    return true;
  } catch {
    return false;
  }
}

function isCoverPath(src: string, slug: string): boolean {
  const coverLocal = `${articlePublicDir(slug)}cover.webp`;
  if (src === coverLocal || src.endsWith(`/${slug}/cover.webp`)) return true;
  if (src.includes("/article-covers/")) return true;
  return false;
}

export async function checkArticleMedia(input: ArticleMediaInput): Promise<ArticleMediaFinding[]> {
  const findings: ArticleMediaFinding[] = [];
  const label = labelOf(input);
  const requireLocalFiles = input.requireLocalFiles !== false;
  const requireImageAlt = input.requireImageAlt !== false;
  const content = input.content_md ?? "";

  // YouTube directives: optional, but must be perfect when present.
  const youtube = findYouTubeDirectives(content);
  for (const directive of youtube) {
    if (!directive.videoId) {
      findings.push({
        level: "error",
        rule: "invalid-youtube-directive",
        message: `${label}: invalid YouTube directive ${JSON.stringify(directive.raw)}. Use a real watch/youtu.be/embed/shorts URL or bare video id.`,
      });
    }
  }

  // Soft signal if someone left a raw youtube.com link instead of the directive.
  if (/\byoutube\.com\/watch\b|\byoutu\.be\//i.test(content) && youtube.length === 0) {
    findings.push({
      level: "warning",
      rule: "youtube-link-without-embed",
      message: `${label}: content has a YouTube URL but no {{ youtube: ... }} embed directive. Either embed a perfect match or remove the raw link.`,
    });
  }

  const images = findMarkdownImages(content);
  for (const image of images) {
    await collectImageFindings(findings, image, input.slug, label, {
      requireLocalFiles,
      requireImageAlt,
      context: "body",
    });
  }

  for (const image of findRawHtmlArticleImages(content)) {
    findings.push({
      level: "error",
      rule: "unsupported-html-image",
      message: `${label}: raw HTML image syntax is not supported (${image.raw}). Use ![alt](/articles/${input.slug}/file.webp) so source, alt text, and file ownership can be verified.`,
    });
  }

  const cover = typeof input.cover_image === "string" ? input.cover_image.trim() : "";
  if (cover) {
    // Covers may be media CDN URLs generated at import time, or local article assets.
    if (cover.startsWith("/")) {
      const classified = classifyArticleImageSrc(cover, input.slug);
      if (!classified.ok) {
        // Cover can also live under /article-covers/ for legacy/generated covers.
        if (!cover.startsWith("/article-covers/") && !cover.startsWith(articlePublicDir(input.slug))) {
          findings.push({
            level: "error",
            rule: "invalid-cover-image",
            message: `${label}: cover_image ${cover} is not a hosted article or article-covers path.`,
          });
        }
      }
      if (requireLocalFiles && (cover.startsWith("/articles/") || cover.startsWith("/article-covers/"))) {
        if (!(await localFileExists(cover))) {
          findings.push({
            level: "error",
            rule: "missing-cover-file",
            message: `${label}: cover_image file missing at apps/web/public${cover}`,
          });
        }
      }
    } else {
      const classified = classifyArticleImageSrc(cover, input.slug);
      if (!classified.ok) {
        findings.push({
          level: "error",
          rule: "invalid-cover-image",
          message: `${label}: cover_image must be a Bloxodes media URL or local public path (got ${cover})`,
        });
      }
    }
  }

  // Duplicate perfect-match guidance: more than one embed is allowed but unusual.
  if (youtube.filter((entry) => entry.videoId).length > 2) {
    findings.push({
      level: "warning",
      rule: "many-youtube-embeds",
      message: `${label}: more than two YouTube embeds. Keep only perfect-match videos.`,
    });
  }

  // Prefer not stacking many body images without alt / purpose.
  const bodyOnly = images.filter((image) => !isCoverPath(image.src, input.slug));
  if (bodyOnly.length > 6) {
    findings.push({
      level: "warning",
      rule: "many-body-images",
      message: `${label}: ${bodyOnly.length} body images. Prefer 0–3 step-relevant clean images.`,
    });
  }

  return findings;
}

async function collectImageFindings(
  findings: ArticleMediaFinding[],
  image: MarkdownImageRef,
  slug: string,
  label: string,
  options: { requireLocalFiles: boolean; requireImageAlt: boolean; context: "body" | "cover" }
) {
  if (options.requireImageAlt && !image.alt.trim()) {
    findings.push({
      level: "error",
      rule: "missing-image-alt",
      message: `${label}: image missing alt text (${image.src}). Describe the useful UI fact.`,
    });
  }

  // Weak alt that looks like keyword stuffing or “image1”
  if (image.alt && /^(image|img|photo|picture|screenshot)\s*\d*$/i.test(image.alt.trim())) {
    findings.push({
      level: "warning",
      rule: "weak-image-alt",
      message: `${label}: weak alt text ${JSON.stringify(image.alt)} for ${image.src}`,
    });
  }

  const classified = classifyArticleImageSrc(image.src, slug);
  if (!classified.ok) {
    findings.push({
      level: "error",
      rule: "disallowed-image-src",
      message: `${label}: ${classified.reason}`,
    });
    return;
  }

  if (classified.kind === "local" && options.requireLocalFiles) {
    if (!(await localFileExists(image.src))) {
      findings.push({
        level: "error",
        rule: "missing-image-file",
        message: `${label}: body image file missing at apps/web/public${image.src}`,
      });
    }
  }
}

export function assertNoArticleMediaErrors(findings: ArticleMediaFinding[]) {
  const errors = findings.filter((finding) => finding.level === "error");
  if (!errors.length) return;
  const lines = errors.map((finding) => `- [${finding.rule}] ${finding.message}`);
  throw new Error(`Article media checks failed:\n${lines.join("\n")}`);
}

export function logArticleMediaFindings(findings: ArticleMediaFinding[]) {
  for (const finding of findings) {
    const prefix = finding.level === "error" ? "ERROR" : "WARN";
    console.log(`${prefix}: ${finding.message}`);
  }
}
