const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

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

/** Accept only HTTPS YouTube watch, short-link and embed URLs for collection media. */
export function extractYouTubeVideoUrlId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be" && /^\/[a-zA-Z0-9_-]{11}$/.test(url.pathname)) {
      id = url.pathname.slice(1);
    } else if ((host === "youtube.com" || host === "m.youtube.com") && url.pathname === "/watch") {
      if (url.searchParams.getAll("v").length !== 1) return null;
      id = url.searchParams.get("v");
    } else if ((host === "youtube.com" || host === "youtube-nocookie.com") && /^\/embed\/[a-zA-Z0-9_-]{11}$/.test(url.pathname)) {
      id = url.pathname.slice("/embed/".length);
    }
    return id && YOUTUBE_VIDEO_ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}
