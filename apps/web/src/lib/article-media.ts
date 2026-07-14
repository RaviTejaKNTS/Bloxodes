/**
 * Article media helpers for YouTube embeds and hosted body/cover images.
 * Used by markdown rendering, tests, and content verification.
 */

export const YOUTUBE_DIRECTIVE_PATTERN = /\{\{\s*youtube\s*:\s*([^\}]+?)\s*\}\}/gi;

/** Public path prefix for article-owned files under apps/web/public/articles/<slug>/ */
export const ARTICLE_PUBLIC_PATH_PREFIX = "/articles/";

const MARKDOWN_IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

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
  index: number;
};

export function extractYouTubeId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  // Bare video id (watch?v= style). Shorts/embed paths use the same charset.
  if (/^[a-zA-Z0-9_-]{6,}$/.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\/+/, "").split("/")[0] || null;
      return id && /^[a-zA-Z0-9_-]{6,}$/.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const id = url.searchParams.get("v");
      if (id && /^[a-zA-Z0-9_-]{6,}$/.test(id)) return id;

      const pathParts = url.pathname.split("/").filter(Boolean);
      const embedIndex = pathParts.indexOf("embed");
      if (embedIndex >= 0 && pathParts[embedIndex + 1]) {
        const embedId = pathParts[embedIndex + 1];
        return /^[a-zA-Z0-9_-]{6,}$/.test(embedId) ? embedId : null;
      }
      const shortsIndex = pathParts.indexOf("shorts");
      if (shortsIndex >= 0 && pathParts[shortsIndex + 1]) {
        const shortsId = pathParts[shortsIndex + 1];
        return /^[a-zA-Z0-9_-]{6,}$/.test(shortsId) ? shortsId : null;
      }
    }

    if (host === "youtube-nocookie.com") {
      const pathParts = url.pathname.split("/").filter(Boolean);
      const embedIndex = pathParts.indexOf("embed");
      if (embedIndex >= 0 && pathParts[embedIndex + 1]) {
        const embedId = pathParts[embedIndex + 1];
        return /^[a-zA-Z0-9_-]{6,}$/.test(embedId) ? embedId : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function findYouTubeDirectives(markdown: string): YouTubeDirectiveMatch[] {
  if (!markdown || !markdown.includes("youtube")) return [];

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
  if (!markdown || !markdown.includes("youtube")) {
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
  const pattern = new RegExp(MARKDOWN_IMAGE_PATTERN.source, "g");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    images.push({
      alt: String(match[1] ?? "").trim(),
      src: String(match[2] ?? "").trim(),
      index: match.index,
    });
  }

  return images;
}

export function articlePublicDir(slug: string): string {
  const clean = slug.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  return `${ARTICLE_PUBLIC_PATH_PREFIX}${clean}/`;
}

export function isLocalArticleImagePath(src: string, slug?: string): boolean {
  if (!src.startsWith(ARTICLE_PUBLIC_PATH_PREFIX)) return false;
  if (!slug) return true;
  return src.startsWith(articlePublicDir(slug));
}

export function isAllowedRemoteArticleImageUrl(src: string): boolean {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return ALLOWED_REMOTE_IMAGE_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
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
 * - site-relative under /articles/<slug>/...
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
    if (isLocalArticleImagePath(value, slug)) {
      return { ok: true, kind: "local" };
    }
    // Allow other local public assets only if clearly under /articles/ for a different slug naming slip.
    if (value.startsWith(ARTICLE_PUBLIC_PATH_PREFIX)) {
      return {
        ok: false,
        reason: `local image path must live under ${articlePublicDir(slug)} (got ${value})`,
      };
    }
    return {
      ok: false,
      reason: `local body images must use ${articlePublicDir(slug)}… (got ${value})`,
    };
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
    reason: `image src must be a hosted /articles/${slug}/… path or Bloxodes media URL (got ${value})`,
  };
}

export function stripArticleMediaForPlainText(markdown: string): string {
  if (!markdown) return "";
  return markdown
    .replace(YOUTUBE_DIRECTIVE_PATTERN, " ")
    .replace(MARKDOWN_IMAGE_PATTERN, " ");
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
