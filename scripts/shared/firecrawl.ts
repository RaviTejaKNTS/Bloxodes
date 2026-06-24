type FirecrawlSearchResult = {
  title?: string;
  description?: string;
  url?: string;
  markdown?: string;
  html?: string;
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
    url?: string;
    statusCode?: number;
    error?: string;
  };
};

type FirecrawlSearchResponse = {
  success?: boolean;
  data?: {
    web?: FirecrawlSearchResult[];
  };
  warning?: string | null;
  id?: string;
  creditsUsed?: number;
};

type FirecrawlSearchOptions = {
  includeDomains?: string[];
  limit?: number;
  scrapeMarkdown?: boolean;
  timeoutMs?: number;
};

const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";

function normalizeDomain(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return trimmed.replace(/^www\./i, "").toLowerCase();
  }
}

export async function firecrawlSearch(
  query: string,
  options: FirecrawlSearchOptions = {}
): Promise<FirecrawlSearchResponse> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Missing FIRECRAWL_API_KEY.");
  }

  const includeDomains = options.includeDomains
    ?.map(normalizeDomain)
    .filter((domain): domain is string => Boolean(domain));

  const response = await fetch(FIRECRAWL_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      query,
      limit: options.limit ?? 10,
      sources: ["web"],
      includeDomains: includeDomains?.length ? includeDomains : undefined,
      country: "US",
      timeout: options.timeoutMs ?? 60000,
      ignoreInvalidURLs: true,
      scrapeOptions: options.scrapeMarkdown
        ? {
            formats: [{ type: "markdown" }]
          }
        : undefined
    })
  });

  if (!response.ok) {
    throw new Error(`Firecrawl search failed (${response.status} ${response.statusText})`);
  }

  const payload = (await response.json()) as FirecrawlSearchResponse;
  if (payload.success === false) {
    throw new Error(payload.warning ?? "Firecrawl search failed.");
  }
  return payload;
}
