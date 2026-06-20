import "../shared/load-env";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_LIMIT_BYTES = 1_800_000;
const DEFAULT_WARN_BYTES = 1_000_000;
const DEFAULT_OUTPUT_DIR = "tmp/html-size-audits";
const DEFAULT_CONCURRENCY = 8;
const USER_AGENT = "BloxodesHtmlSizeAudit/1.0 (+https://bloxodes.com)";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type Result = {
  url: string;
  status: number;
  contentType: string;
  bytes: number;
  ok: boolean;
  warning: boolean;
  durationMs: number;
  error: string | null;
};

function parseArgs(argv: string[]) {
  const urls: string[] = [];
  let sitemap: string | null = null;
  let limitBytes = DEFAULT_LIMIT_BYTES;
  let warnBytes = DEFAULT_WARN_BYTES;
  let outputDir = DEFAULT_OUTPUT_DIR;
  let concurrency = DEFAULT_CONCURRENCY;
  let failOnLimit = false;
  let rewriteOriginFrom: string | null = null;
  let rewriteOriginTo: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };

    if (arg === "--url") urls.push(next());
    else if (arg === "--sitemap") sitemap = next();
    else if (arg === "--limit-bytes") limitBytes = Number(next());
    else if (arg === "--warn-bytes") warnBytes = Number(next());
    else if (arg === "--output-dir") outputDir = next();
    else if (arg === "--concurrency") concurrency = Number(next());
    else if (arg === "--rewrite-origin") {
      rewriteOriginFrom = next().replace(/\/$/, "");
      rewriteOriginTo = next().replace(/\/$/, "");
    }
    else if (arg === "--fail-on-limit") failOnLimit = true;
    else if (arg === "--help") {
      console.log(`Usage:
  npm run audit:html-size -- --url https://bloxodes.com/wiki/pet-simulator-99/pets
  npm run audit:html-size -- --sitemap https://bloxodes.com/sitemaps/wiki.xml --fail-on-limit

Options:
  --url <url>             URL to measure. Repeatable.
  --sitemap <url>         Sitemap URL to read URLs from.
  --limit-bytes <n>       Fail threshold. Default ${DEFAULT_LIMIT_BYTES}
  --warn-bytes <n>        Warning threshold. Default ${DEFAULT_WARN_BYTES}
  --concurrency <n>       Parallel requests. Default ${DEFAULT_CONCURRENCY}
  --output-dir <path>     Output directory. Default ${DEFAULT_OUTPUT_DIR}
  --rewrite-origin <from> <to>
                          Rewrite sitemap URL origins, useful for localhost checks.
  --fail-on-limit         Exit 1 when any URL exceeds --limit-bytes
`);
      process.exit(0);
    }
  }

  if (!Number.isFinite(limitBytes) || limitBytes <= 0) throw new Error("Invalid --limit-bytes");
  if (!Number.isFinite(warnBytes) || warnBytes <= 0) throw new Error("Invalid --warn-bytes");
  if (!Number.isFinite(concurrency) || concurrency <= 0) throw new Error("Invalid --concurrency");

  return {
    urls,
    sitemap,
    limitBytes,
    warnBytes,
    outputDir,
    concurrency: Math.min(32, Math.floor(concurrency)),
    rewriteOriginFrom,
    rewriteOriginTo,
    failOnLimit
  };
}

function rewriteUrl(url: string, from: string | null, to: string | null) {
  if (!from || !to || !url.startsWith(from)) return url;
  return `${to}${url.slice(from.length)}`;
}

async function readSitemapUrls(sitemapUrl: string) {
  const response = await fetch(sitemapUrl, {
    headers: {
      "accept-encoding": "identity",
      "user-agent": USER_AGENT
    }
  });
  const body = await response.text();
  return Array.from(body.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1].trim()).filter(Boolean);
}

async function measureUrl(url: string, limitBytes: number, warnBytes: number): Promise<Result> {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "accept-encoding": "identity",
        "user-agent": USER_AGENT
      }
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "";
    const bytes = buffer.byteLength;
    return {
      url,
      status: response.status,
      contentType,
      bytes,
      ok: response.ok && bytes <= limitBytes,
      warning: bytes > warnBytes,
      durationMs: Date.now() - startedAt,
      error: null
    };
  } catch (error) {
    return {
      url,
      status: 0,
      contentType: "",
      bytes: 0,
      ok: false,
      warning: false,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function runQueue<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results: R[] = [];
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      results.push(await worker(item));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sitemapUrls = options.sitemap ? await readSitemapUrls(options.sitemap) : [];
  const urls = Array.from(
    new Set(
      [...options.urls, ...sitemapUrls].map((url) =>
        rewriteUrl(url, options.rewriteOriginFrom, options.rewriteOriginTo)
      )
    )
  );
  if (!urls.length) throw new Error("Provide --url or --sitemap");

  const results = await runQueue(urls, options.concurrency, (url) =>
    measureUrl(url, options.limitBytes, options.warnBytes)
  );
  const sorted = results.sort((a, b) => b.bytes - a.bytes);
  const overLimit = sorted.filter((result) => result.bytes > options.limitBytes || result.error || result.status >= 400);
  const warnings = sorted.filter((result) => result.warning);
  const generatedAt = new Date().toISOString();
  const outDir = path.resolve(repoRoot, options.outputDir);
  await mkdir(outDir, { recursive: true });

  const tsv = [
    "url\tstatus\tbytes\tmb\twarning\terror\tcontent_type\tduration_ms",
    ...sorted.map((result) =>
      [
        result.url,
        result.status,
        result.bytes,
        (result.bytes / 1_000_000).toFixed(3),
        result.warning ? "yes" : "no",
        result.error ?? "",
        result.contentType,
        result.durationMs
      ].join("\t")
    )
  ].join("\n");

  const summary = {
    generatedAt,
    checked: sorted.length,
    warnBytes: options.warnBytes,
    limitBytes: options.limitBytes,
    warningCount: warnings.length,
    overLimitCount: overLimit.length,
    largest: sorted.slice(0, 25)
  };

  await writeFile(path.join(outDir, "html-size-results.tsv"), `${tsv}\n`);
  await writeFile(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

  console.log(`Checked ${sorted.length} URLs`);
  console.log(`Warnings > ${options.warnBytes}: ${warnings.length}`);
  console.log(`Over limit/errors > ${options.limitBytes}: ${overLimit.length}`);
  for (const result of sorted.slice(0, 10)) {
    console.log(`${(result.bytes / 1_000_000).toFixed(3)} MB\t${result.status}\t${result.url}`);
  }

  if (options.failOnLimit && overLimit.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
