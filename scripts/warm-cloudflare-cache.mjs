const DEFAULT_CONCURRENCY = 8;
const DEFAULT_MAX_SITEMAPS = 200;
const DEFAULT_MAX_URLS = 5000;
const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
const DEFAULT_REQUEST_DELAY_MS = 0;

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function normalizeAbsoluteUrl(value, base) {
  const url = new URL(value, base);
  if (!/^https?:$/i.test(url.protocol)) {
    throw new Error(`Unsupported URL protocol: ${url.protocol}`);
  }
  url.hash = "";
  return url.toString();
}

function extractLocValues(xml) {
  const matches = xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi);
  const values = [];
  for (const match of matches) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    const decoded = raw
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    values.push(decoded);
  }
  return values;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        accept: "application/xml,text/xml,text/html,application/xhtml+xml,*/*",
        "user-agent": "BloxodesCacheWarmup/1.0"
      },
      signal: controller.signal
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
    }

    return res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function collectUrlsFromSitemaps({ sitemapUrl, siteOrigin, maxSitemaps, maxUrls }) {
  const root = new URL(siteOrigin);
  const queue = [normalizeAbsoluteUrl(sitemapUrl, siteOrigin)];
  const seenSitemaps = new Set();
  const pageUrls = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || seenSitemaps.has(current)) continue;
    if (seenSitemaps.size >= maxSitemaps) {
      throw new Error(`Sitemap crawl exceeded CACHE_WARM_MAX_SITEMAPS=${maxSitemaps}`);
    }

    seenSitemaps.add(current);
    console.log(`Sitemap ${seenSitemaps.size}: ${current}`);
    const xml = await fetchText(current);
    const locValues = extractLocValues(xml);
    if (!locValues.length) continue;

    if (/<\s*sitemapindex\b/i.test(xml)) {
      for (const loc of locValues) {
        let nested;
        try {
          nested = normalizeAbsoluteUrl(loc, current);
        } catch {
          continue;
        }
        if (new URL(nested).host !== root.host) continue;
        if (!seenSitemaps.has(nested)) queue.push(nested);
      }
      continue;
    }

    if (/<\s*urlset\b/i.test(xml)) {
      for (const loc of locValues) {
        let pageUrl;
        try {
          pageUrl = normalizeAbsoluteUrl(loc, current);
        } catch {
          continue;
        }
        if (new URL(pageUrl).host !== root.host) continue;
        pageUrls.add(pageUrl);
        if (pageUrls.size >= maxUrls) {
          console.warn(`Reached CACHE_WARM_MAX_URLS=${maxUrls}; truncating warmup list.`);
          return { urls: Array.from(pageUrls), sitemapCount: seenSitemaps.size };
        }
      }
    }
  }

  return { urls: Array.from(pageUrls), sitemapCount: seenSitemaps.size };
}

async function warmUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent": "BloxodesCacheWarmup/1.0"
      },
      signal: controller.signal
    });

    await res.arrayBuffer();

    return {
      url,
      ok: res.ok,
      status: res.status,
      finalUrl: res.url,
      cfCacheStatus: res.headers.get("cf-cache-status"),
      nextCacheStatus: res.headers.get("x-nextjs-cache"),
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function warmUrls(urls, { concurrency, requestDelayMs }) {
  const results = [];
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= urls.length) return;

      const url = urls[index];
      const result = await warmUrl(url);
      results[index] = result;

      const outcome = result.ok ? "OK" : "ERR";
      console.log(
        `[${index + 1}/${urls.length}] ${outcome} ${result.status} ${result.durationMs}ms ${result.cfCacheStatus ?? "-"} ${url}`
      );

      if (requestDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, requestDelayMs));
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const siteOrigin = process.env.CACHE_WARM_SITE_URL?.trim() || process.env.PRODUCTION_SITE_URL?.trim();
  if (!siteOrigin) {
    throw new Error("CACHE_WARM_SITE_URL or PRODUCTION_SITE_URL is required.");
  }

  const normalizedSiteOrigin = new URL(siteOrigin).origin;
  const sitemapUrl =
    process.env.CACHE_WARM_SITEMAP_URL?.trim() || `${normalizedSiteOrigin.replace(/\/$/, "")}/sitemap.xml`;
  const concurrency = clampNumber(process.env.CACHE_WARM_CONCURRENCY, DEFAULT_CONCURRENCY, 1, 32);
  const maxSitemaps = clampNumber(process.env.CACHE_WARM_MAX_SITEMAPS, DEFAULT_MAX_SITEMAPS, 1, 10000);
  const maxUrls = clampNumber(process.env.CACHE_WARM_MAX_URLS, DEFAULT_MAX_URLS, 1, 50000);
  const requestDelayMs = clampNumber(process.env.CACHE_WARM_REQUEST_DELAY_MS, DEFAULT_REQUEST_DELAY_MS, 0, 5000);

  console.log(`Warmup site origin: ${normalizedSiteOrigin}`);
  console.log(`Warmup sitemap: ${sitemapUrl}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Max sitemaps: ${maxSitemaps}`);
  console.log(`Max urls: ${maxUrls}`);

  const discovered = await collectUrlsFromSitemaps({
    sitemapUrl,
    siteOrigin: normalizedSiteOrigin,
    maxSitemaps,
    maxUrls
  });

  const urls = [
    `${normalizedSiteOrigin}/sitemap.xml`,
    ...discovered.urls.filter((url, index, arr) => arr.indexOf(url) === index)
  ];

  console.log(`Discovered ${discovered.urls.length} page URLs from ${discovered.sitemapCount} sitemap files.`);
  console.log(`Warming ${urls.length} URLs including sitemap index.`);

  const results = await warmUrls(urls, { concurrency, requestDelayMs });

  const okCount = results.filter((result) => result?.ok).length;
  const failed = results.filter((result) => result && !result.ok);
  const averageMs =
    results.length > 0
      ? Math.round(results.reduce((sum, result) => sum + (result?.durationMs ?? 0), 0) / results.length)
      : 0;

  console.log(`Warmup finished: ${okCount}/${results.length} succeeded, avg ${averageMs}ms.`);

  if (failed.length) {
    console.error("Warmup failures:");
    for (const item of failed.slice(0, 20)) {
      console.error(`- ${item.url} :: ${item.status || item.error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
