/**
 * Article media helpers for YouTube embeds and hosted body/cover images.
 * Used by markdown rendering, tests, and content verification.
 */

import { lexer, walkTokens, type Token } from "marked";

export const YOUTUBE_DIRECTIVE_PATTERN = /\{\{\s*youtube\s*:\s*([^\}]+?)\s*\}\}/gi;

/** Public path prefix for article-owned files under apps/web/public/articles/<slug>/ */
export const ARTICLE_PUBLIC_PATH_PREFIX = "/articles/";

const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const MARKDOWN_REFERENCE_DEFINITION_PATTERN = /^[ \t]{0,3}\[[^\]\n]+\]:[ \t]*(?:<[^>\n]+>|\S+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^\)\n]*\)))?[ \t]*$/gm;

const ALLOWED_REMOTE_IMAGE_HOST_SUFFIXES = [
  "media.bloxodes.com",
  "bloxodes.com",
] as const;

const BLOCKED_HOTLINK_HOST_HINTS = [
  "static.wikia.nocookie.net",
  "vignette.wikia.nocookie.net",
  "fandom.com",
  "imgur.com",
  "i.imgur.com",
  "googleusercontent.com",
  "pinimg.com",
  "discordapp.com",
  "discord.com",
  "media.discordapp.net",
  "robloxden.com",
  "beebom.com",
  "progameguides.com",
  "destructoid.com",
] as const;

export type YouTubeDirectiveMatch = {
  raw: string;
  value: string;
  videoId: string | null;
  index: number;
};

export type MarkdownImageRef = {
  alt: string;
  src: string;
  raw: string;
  index: number;
};

export type RawHtmlImageRef = {
  raw: string;
  index: number;
};

export function extractYouTubeId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  // Bare video id (watch?v= style). Shorts/embed paths use the same charset.
  if (YOUTUBE_VIDEO_ID_PATTERN.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\/+/, "").split("/")[0] || null;
      return id && YOUTUBE_VIDEO_ID_PATTERN.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const id = url.searchParams.get("v");
      if (id && YOUTUBE_VIDEO_ID_PATTERN.test(id)) return id;

      const pathParts = url.pathname.split("/").filter(Boolean);
      const embedIndex = pathParts.indexOf("embed");
      if (embedIndex >= 0 && pathParts[embedIndex + 1]) {
        const embedId = pathParts[embedIndex + 1];
        return YOUTUBE_VIDEO_ID_PATTERN.test(embedId) ? embedId : null;
      }
      const shortsIndex = pathParts.indexOf("shorts");
      if (shortsIndex >= 0 && pathParts[shortsIndex + 1]) {
        const shortsId = pathParts[shortsIndex + 1];
        return YOUTUBE_VIDEO_ID_PATTERN.test(shortsId) ? shortsId : null;
      }
    }

    if (host === "youtube-nocookie.com") {
      const pathParts = url.pathname.split("/").filter(Boolean);
      const embedIndex = pathParts.indexOf("embed");
      if (embedIndex >= 0 && pathParts[embedIndex + 1]) {
        const embedId = pathParts[embedIndex + 1];
        return YOUTUBE_VIDEO_ID_PATTERN.test(embedId) ? embedId : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function findYouTubeDirectives(markdown: string): YouTubeDirectiveMatch[] {
  if (!markdown || !/youtube/i.test(markdown)) return [];

  const matches: YouTubeDirectiveMatch[] = [];
  const pattern = new RegExp(YOUTUBE_DIRECTIVE_PATTERN.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    const value = String(match[1] ?? "").trim();
    matches.push({
      raw: match[0],
      value,
      videoId: extractYouTubeId(value),
      index: match.index,
    });
  }

  return matches;
}

export function buildYouTubeEmbedHtml(videoId: string): string {
  return [
    '<div class="video-embed">',
    `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}"`,
    'title="YouTube video player"',
    'frameborder="0"',
    'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"',
    "allowfullscreen",
    'loading="lazy"',
    'referrerpolicy="strict-origin-when-cross-origin"></iframe>',
    "</div>",
  ].join(" ");
}

export function injectYouTubeEmbeds(markdown: string): string {
  if (!markdown || !/youtube/i.test(markdown)) {
    return markdown;
  }

  return markdown.replace(YOUTUBE_DIRECTIVE_PATTERN, (_match, rawValue) => {
    const videoId = extractYouTubeId(String(rawValue));
    if (!videoId) return _match;
    return buildYouTubeEmbedHtml(videoId);
  });
}

export function findMarkdownImages(markdown: string): MarkdownImageRef[] {
  if (!markdown || !markdown.includes("![")) return [];

  const images: MarkdownImageRef[] = [];
  const tokens = lexer(markdown);
  let searchFrom = 0;

  walkTokens(tokens, (token: Token) => {
    if (token.type !== "image") return;
    const index = markdown.indexOf(token.raw, searchFrom);
    images.push({
      alt: token.text.trim(),
      src: token.href.trim(),
      raw: token.raw,
      index: index >= 0 ? index : searchFrom,
    });
    if (index >= 0) searchFrom = index + token.raw.length;
  });

  return images;
}

/** Raw HTML images render through marked but are intentionally unsupported by article verification. */
export function findRawHtmlArticleImages(markdown: string): RawHtmlImageRef[] {
  if (!markdown || !/<img\b/i.test(markdown)) return [];

  const images: RawHtmlImageRef[] = [];
  const tokens = lexer(markdown);
  let searchFrom = 0;

  walkTokens(tokens, (token: Token) => {
    if (token.type !== "html" || !/<img\b/i.test(token.raw)) return;
    const tokenIndex = markdown.indexOf(token.raw, searchFrom);
    const pattern = /<img\b[^>]*>/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(token.raw)) !== null) {
      images.push({
        raw: match[0],
        index: (tokenIndex >= 0 ? tokenIndex : searchFrom) + match.index,
      });
    }
    if (tokenIndex >= 0) searchFrom = tokenIndex + token.raw.length;
  });

  return images;
}

export function articlePublicDir(slug: string): string {
  const clean = slug.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  return `${ARTICLE_PUBLIC_PATH_PREFIX}${clean}/`;
}

export function isValidArticleSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function safeSiteRelativePath(src: string): string | null {
  if (!src.startsWith("/") || src.startsWith("//") || /[?#]/.test(src)) return null;

  let decoded = src;
  try {
    for (let i = 0; i < 4; i += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return null;
  }

  if (decoded.includes("\\") || decoded.includes("\0")) return null;
  if (decoded.split("/").some((segment) => segment === "." || segment === "..")) return null;
  return decoded;
}

export function isSafeSiteRelativePath(src: string): boolean {
  return safeSiteRelativePath(src) !== null;
}

export function isLocalArticleImagePath(src: string, slug?: string): boolean {
  const safePath = safeSiteRelativePath(src);
  if (!safePath?.startsWith(ARTICLE_PUBLIC_PATH_PREFIX)) return false;
  if (!slug) return true;
  return safePath.startsWith(articlePublicDir(slug));
}

export function isAllowedRemoteArticleImageUrl(src: string): boolean {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (ALLOWED_REMOTE_IMAGE_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    )) {
      return true;
    }

    if (!url.pathname.includes("/storage/v1/object/public/")) return false;
    const configuredOrigins = [
      process.env.SUPABASE_MEDIA_PUBLIC_URL,
      process.env.SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => {
        try {
          return [new URL(value).origin];
        } catch {
          return [];
        }
      });
    return configuredOrigins.includes(url.origin);
  } catch {
    return false;
  }
}

export function isBlockedHotlinkImageUrl(src: string): boolean {
  try {
    const url = new URL(src);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return BLOCKED_HOTLINK_HOST_HINTS.some(
      (hint) => host === hint || host.endsWith(`.${hint}`) || host.includes(hint)
    );
  } catch {
    return false;
  }
}

/**
 * Body/cover images in finals should be:
 * - a safe site-relative public asset (article-owned or a reusable game asset)
 * - or already on Bloxodes media hosts
 * Remote hotlinks from wikis/competitors are rejected.
 */
export function classifyArticleImageSrc(
  src: string,
  slug: string
): { ok: true; kind: "local" | "bloxodes-remote" } | { ok: false; reason: string } {
  const value = src.trim();
  if (!value) return { ok: false, reason: "empty image src" };

  if (value.startsWith("/")) {
    if (!isSafeSiteRelativePath(value)) {
      return { ok: false, reason: `unsafe local image path (got ${value})` };
    }
    if (isLocalArticleImagePath(value, slug)) {
      return { ok: true, kind: "local" };
    }
    // Keep article-owned assets scoped to their article, while allowing canonical
    // game/collection assets elsewhere in apps/web/public to be reused.
    if (value.startsWith(ARTICLE_PUBLIC_PATH_PREFIX)) {
      return {
        ok: false,
        reason: `local image path must live under ${articlePublicDir(slug)} (got ${value})`,
      };
    }
    return { ok: true, kind: "local" };
  }

  if (isAllowedRemoteArticleImageUrl(value)) {
    return { ok: true, kind: "bloxodes-remote" };
  }

  if (isBlockedHotlinkImageUrl(value)) {
    return {
      ok: false,
      reason: `hotlinked image is not allowed; host and use a local path under ${articlePublicDir(slug)} (got ${value})`,
    };
  }

  return {
    ok: false,
    reason: `image src must be a safe local public path or Bloxodes media URL (got ${value})`,
  };
}

export function stripArticleMediaForPlainText(markdown: string): string {
  if (!markdown) return "";
  let stripped = markdown.replace(YOUTUBE_DIRECTIVE_PATTERN, " ");
  const images = findMarkdownImages(stripped).sort((a, b) => b.index - a.index);
  for (const image of images) {
    stripped = `${stripped.slice(0, image.index)} ${stripped.slice(image.index + image.raw.length)}`;
  }
  return stripped.replace(MARKDOWN_REFERENCE_DEFINITION_PATTERN, " ");
}

export function suggestArticleImageMarkdown(params: {
  slug: string;
  fileName: string;
  alt: string;
}): string {
  const slug = params.slug.trim().toLowerCase();
  const fileName = params.fileName.replace(/^\/+/, "");
  const alt = params.alt.trim() || "Article image";
  return `![${alt}](${ARTICLE_PUBLIC_PATH_PREFIX}${slug}/${fileName})`;
}
