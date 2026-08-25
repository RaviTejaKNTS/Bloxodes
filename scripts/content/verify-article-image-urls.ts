export type ArticleImageFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

type VerifyArticleImageUrlsOptions = {
  articleUrl: string;
  imageSources: string[];
  fetcher?: ArticleImageFetch;
  concurrency?: number;
  timeoutMs?: number;
};

function resolvedImageUrls(articleUrl: string, imageSources: string[]): string[] {
  const unique = new Set<string>();

  for (const source of imageSources) {
    const url = new URL(source, articleUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(`Unsupported rendered image URL: ${source}`);
    }
    unique.add(url.toString());
  }

  return Array.from(unique);
}

async function verifyOneImage(
  url: string,
  fetcher: ArticleImageFetch,
  timeoutMs: number,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`${url} returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      throw new Error(`${url} returned ${contentType || "an unknown content type"}, not an image`);
    }

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 1) {
      throw new Error(`${url} returned an empty image response`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyArticleImageUrls(
  options: VerifyArticleImageUrlsOptions,
): Promise<string[]> {
  const urls = resolvedImageUrls(options.articleUrl, options.imageSources);
  const fetcher = options.fetcher ?? fetch;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 8, 16));
  const timeoutMs = options.timeoutMs ?? 20_000;

  for (let index = 0; index < urls.length; index += concurrency) {
    const batch = urls.slice(index, index + concurrency);
    await Promise.all(batch.map((url) => verifyOneImage(url, fetcher, timeoutMs)));
  }

  return urls;
}
