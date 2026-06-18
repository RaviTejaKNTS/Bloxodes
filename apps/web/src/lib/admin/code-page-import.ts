import { detectProvider, scrapeSources } from "@/lib/scraper";
import { normalizeGameSlug } from "@/lib/slug";
import { upsertScrapedCodesForCodePage } from "@/lib/admin/code-upsert";

type ComputeArgs = {
  slug?: string | null;
  name?: string | null;
  sourceUrl: string;
};

export function computeCodePageDetails({ slug, name, sourceUrl }: ComputeArgs): { slug: string; name: string } {
  const trimmedSlug = slug?.trim();
  const trimmedName = name?.trim();

  const deriveNameFromSlug = (value: string | null | undefined) => {
    if (!value) return null;
    return value
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  };

  const deriveSlugFromUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split("/").filter(Boolean);
      const last = parts.pop();
      if (last) return last;
    } catch {
      // ignore
    }
    return null;
  };

  const baseSlug = trimmedSlug || deriveSlugFromUrl(sourceUrl) || trimmedName || sourceUrl;
  const finalSlug = normalizeGameSlug(trimmedName || baseSlug, baseSlug);
  const finalName = trimmedName || deriveNameFromSlug(finalSlug) || "Untitled Game";

  return { slug: finalSlug, name: finalName };
}

type SyncResult = {
  codesFound: number;
  codesUpserted: number;
  errors: string[];
};

export async function syncCodePageCodesFromSources(
  sb: any,
  codePageId: string,
  urls: Array<string | null | undefined>
): Promise<SyncResult> {
  const uniqueUrls = Array.from(new Set(urls.filter((u): u is string => Boolean(u))));
  if (!uniqueUrls.length) {
    return { codesFound: 0, codesUpserted: 0, errors: ["No source URLs provided"] };
  }

  const enabledUrls = uniqueUrls.filter((url) => {
    try {
      return Boolean(detectProvider(url));
    } catch {
      return false;
    }
  });

  if (!enabledUrls.length) {
    return { codesFound: 0, codesUpserted: 0, errors: ["No supported source URLs provided"] };
  }

  try {
    const scraped = await scrapeSources(enabledUrls);
    const { data: codePage, error: codePageError } = await sb
      .from("code_pages")
      .select("expired_codes")
      .eq("id", codePageId)
      .maybeSingle();

    if (codePageError) {
      return {
        codesFound: 0,
        codesUpserted: 0,
        errors: [codePageError.message]
      };
    }

    const upsert = await upsertScrapedCodesForCodePage(sb, {
      codePageId,
      existingExpiredCodes: codePage?.expired_codes,
      codes: scraped.codes ?? [],
      expiredCodes: scraped.expiredCodes ?? [],
      expireMissingActive: true,
    });

    return {
      codesFound: upsert.codesFound,
      codesUpserted: upsert.codesUpserted,
      errors: upsert.errors
    };
  } catch (error) {
    return {
      codesFound: 0,
      codesUpserted: 0,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}
