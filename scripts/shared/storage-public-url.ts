const PUBLIC_STORAGE_PATH = "/storage/v1/object/public/";

export function toMediaPublicUrl(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null;

  const mediaBase = process.env.SUPABASE_MEDIA_PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (!mediaBase) return publicUrl;

  try {
    const url = new URL(publicUrl);
    const storagePathIndex = url.pathname.indexOf(PUBLIC_STORAGE_PATH);
    if (storagePathIndex === -1) return publicUrl;

    const mediaUrl = new URL(mediaBase);
    mediaUrl.pathname = url.pathname;
    mediaUrl.search = url.search;
    mediaUrl.hash = url.hash;
    return mediaUrl.toString();
  } catch {
    return publicUrl;
  }
}
