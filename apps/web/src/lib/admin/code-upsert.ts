import { normalizeCodeKey, sanitizeCodeDisplay } from "@/lib/code-normalization";
import { getCodeDisplayPriority } from "@/lib/scraper";
import type { ScrapedCode, ScrapedExpiredCode } from "@/lib/scraper-types";

type SupabaseLike = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: any }>;
};

export type CodeStatus = "active" | "expired" | "check";

export type CodePageCodeInput = {
  code: string;
  status?: CodeStatus;
  rewardsText?: string | null;
  levelRequirement?: number | null;
  isNew?: boolean | null;
  provider?: ScrapedCode["provider"];
  providerPriority?: number | null;
};

export type CodeUpsertResult = {
  codesFound: number;
  codesUpserted: number;
  codesExpired: number;
  errors: string[];
};

type ExistingCodeRow = {
  code: string | null;
  status: string | null;
  provider_priority: number | null;
};

function toCodeInput(code: ScrapedCode): CodePageCodeInput {
  return {
    code: code.code,
    status: code.status,
    rewardsText: code.rewardsText ?? null,
    levelRequirement: code.levelRequirement ?? null,
    isNew: code.isNew ?? false,
    provider: code.provider,
    providerPriority: code.providerPriority ?? null,
  };
}

function toExpiredInput(code: ScrapedExpiredCode): CodePageCodeInput | null {
  const displayCode = sanitizeCodeDisplay(typeof code === "string" ? code : code.code);
  if (!displayCode) return null;
  return {
    code: displayCode,
    status: "expired",
    provider: typeof code === "string" ? undefined : code.provider,
  };
}

function sameStringArray(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export async function upsertCodesForCodePage(
  sb: SupabaseLike,
  params: {
    codePageId: string;
    existingExpiredCodes?: unknown;
    codes?: CodePageCodeInput[];
    expiredCodes?: ScrapedExpiredCode[];
    expireMissingActive?: boolean;
  }
): Promise<CodeUpsertResult> {
  const activeOrCheckCodes = params.codes ?? [];
  const explicitExpiredCodes = (params.expiredCodes ?? [])
    .map(toExpiredInput)
    .filter((entry): entry is CodePageCodeInput => Boolean(entry));
  const allIncoming = [...activeOrCheckCodes, ...explicitExpiredCodes];
  const result: CodeUpsertResult = {
    codesFound: allIncoming.length,
    codesUpserted: 0,
    codesExpired: 0,
    errors: [],
  };

  const { data: existingRows, error: existingError } = await sb
    .from("codes")
    .select("code, status, provider_priority")
    .eq("code_page_id", params.codePageId);

  if (existingError) {
    return {
      ...result,
      errors: [`Failed to load existing codes: ${existingError.message}`],
    };
  }

  const existingActiveByNormalized = new Map<string, string>();
  for (const row of (existingRows ?? []) as ExistingCodeRow[]) {
    const displayCode = sanitizeCodeDisplay(row.code ?? undefined);
    if (!displayCode) continue;
    const normalized = normalizeCodeKey(displayCode);
    if (!normalized) continue;
    if (row.status === "active") {
      existingActiveByNormalized.set(normalized, displayCode);
    }
  }

  const existingExpiredArray = Array.isArray(params.existingExpiredCodes)
    ? params.existingExpiredCodes
        .map((code) => sanitizeCodeDisplay(typeof code === "string" ? code : null))
        .filter((code): code is string => Boolean(code))
    : [];

  const expiredByNormalized = new Map<string, { display: string; priority: number }>();
  for (const displayCode of existingExpiredArray) {
    const normalized = normalizeCodeKey(displayCode);
    if (!normalized) continue;
    expiredByNormalized.set(normalized, { display: displayCode, priority: -1 });
  }

  const incomingActiveNormalized = new Set<string>();
  const incomingExpiredNormalized = new Set<string>();

  for (const entry of allIncoming) {
    const displayCode = sanitizeCodeDisplay(entry.code);
    if (!displayCode) continue;
    const normalized = normalizeCodeKey(displayCode);
    if (!normalized) continue;

    const status = entry.status === "check" ? "expired" : entry.status ?? "active";
    const providerPriority = Number(entry.providerPriority ?? getCodeDisplayPriority(entry.provider));
    if (status === "expired") {
      incomingExpiredNormalized.add(normalized);
      const existing = expiredByNormalized.get(normalized);
      if (!existing || providerPriority >= existing.priority) {
        expiredByNormalized.set(normalized, { display: displayCode, priority: providerPriority });
      }
    } else {
      incomingActiveNormalized.add(normalized);
      expiredByNormalized.delete(normalized);
    }

    const { error } = await sb.rpc("upsert_code", {
      p_code_page_id: params.codePageId,
      p_code: displayCode,
      p_status: status,
      p_rewards_text: entry.rewardsText ?? null,
      p_level_requirement: entry.levelRequirement ?? null,
      p_is_new: Boolean(entry.isNew && status === "active"),
      p_provider_priority: providerPriority,
    });

    if (error) {
      result.errors.push(`Failed to upsert ${displayCode}: ${error.message}`);
      continue;
    }

    result.codesUpserted += 1;
  }

  if (params.expireMissingActive) {
    const missingActiveCodes = Array.from(existingActiveByNormalized.entries())
      .filter(([normalized]) => !incomingActiveNormalized.has(normalized))
      .map(([normalized, display]) => ({ normalized, display }));

    if (missingActiveCodes.length) {
      const { error: expireError } = await sb
        .from("codes")
        .update({
          status: "expired",
          is_new: false,
          last_seen_at: new Date().toISOString(),
        })
        .eq("code_page_id", params.codePageId)
        .in("code", missingActiveCodes.map((entry) => entry.display));

      if (expireError) {
        result.errors.push(`Failed to expire missing active codes: ${expireError.message}`);
      } else {
        result.codesExpired += missingActiveCodes.length;
        for (const entry of missingActiveCodes) {
          if (!incomingExpiredNormalized.has(entry.normalized)) {
            expiredByNormalized.set(entry.normalized, { display: entry.display, priority: 0 });
          }
        }
      }
    }
  }

  const updatedExpiredCodes = Array.from(expiredByNormalized.values()).map((entry) => entry.display);
  if (!sameStringArray(updatedExpiredCodes, existingExpiredArray)) {
    const { error: expiredUpdateError } = await sb
      .from("code_pages")
      .update({ expired_codes: updatedExpiredCodes })
      .eq("id", params.codePageId);

    if (expiredUpdateError) {
      result.errors.push(`Failed to update expired_codes: ${expiredUpdateError.message}`);
    }
  }

  return result;
}

export async function upsertScrapedCodesForCodePage(
  sb: SupabaseLike,
  params: {
    codePageId: string;
    existingExpiredCodes?: unknown;
    codes: ScrapedCode[];
    expiredCodes?: ScrapedExpiredCode[];
    expireMissingActive?: boolean;
  }
): Promise<CodeUpsertResult> {
  return upsertCodesForCodePage(sb, {
    codePageId: params.codePageId,
    existingExpiredCodes: params.existingExpiredCodes,
    codes: params.codes.map(toCodeInput),
    expiredCodes: params.expiredCodes,
    expireMissingActive: params.expireMissingActive,
  });
}
