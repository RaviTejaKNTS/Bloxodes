import { normalizeCodeKey, stripPastedCopySuffix } from "./code-normalization";
import { getCodeDisplayPriority as providerVotePriority } from "./scraper";
import type { ScrapedCode, ScrapedExpiredCode } from "./scraper-types";

export type StoredCodeRow = {
  code: string;
  status: string;
  providerPriority: number;
};

export type CodeRefreshUpsert = {
  code: string;
  status: "active" | "expired";
  rewardsText: string | null;
  levelRequirement: number | null;
  isNew: boolean;
  providerPriority: number;
};

export type CodeRefreshPlan = {
  /** `upsert_code` RPC calls, in call order. */
  upserts: CodeRefreshUpsert[];
  /** Stored spellings of active rows to refresh `last_seen_at` on. */
  touch: string[];
  /**
   * Stored spellings of rows marked "check". Run after the upserts, limited to
   * rows whose status is still "check".
   */
  convertCheck: string[];
  /**
   * Stored spellings of active rows to set expired directly. This runs after
   * the upserts because `upsert_code` ignores a status from a lower provider
   * priority than the stored row.
   */
  expire: string[];
  /** How many entries of `expire` a source reported as not working. */
  expiredByVote: number;
  /** How many entries of `expire` no source listed at all. */
  expiredAsMissing: number;
  /** New `code_pages.expired_codes` value. */
  expiredCodes: string[];
  newCodes: number;
};

export type CodeRefreshInput = {
  /** Merged scrape result (`mergeScrapeResults`). */
  codes: ScrapedCode[];
  expiredCodes: ScrapedExpiredCode[];
  /** True when at least one source failed this run. */
  hasSourceFailures: boolean;
  /** Stored `codes` rows for the page, with sanitized display codes. */
  existingRows: StoredCodeRow[];
  /** Current `code_pages.expired_codes`, already cleaned. */
  existingExpiredCodes: string[];
};

/**
 * Decides what a codes refresh writes for one page. Same rules for every game:
 *
 * - Every source votes per code: active, or not working ("check" or an expired
 *   list). The vote from the highest provider priority wins; a tie goes to not
 *   working. A code only one source lists as active, with no not-working vote,
 *   stays active.
 * - A code whose winning vote is not working is expired, even when its stored
 *   row has a higher provider priority than the source that reported it.
 * - A stored active code no source lists at all is expired only when every
 *   source answered (`hasSourceFailures` false). Explicit not-working votes
 *   still apply on a partial scrape.
 * - Reactivation and display spelling stay with `upsert_code`, which only lets
 *   an equal or higher provider priority change a stored row.
 */
export function planCodeRefresh(input: CodeRefreshInput): CodeRefreshPlan {
  const activeVote = new Map<string, number>();
  const notWorkingVote = new Map<string, number>();
  const vote = (map: Map<string, number>, key: string, priority: number) => {
    map.set(key, Math.max(map.get(key) ?? -1, priority));
  };

  type Incoming = { key: string; display: string; entry: ScrapedCode; priority: number };
  const incoming: Incoming[] = [];
  for (const entry of input.codes) {
    const display = stripPastedCopySuffix(entry.code);
    if (!display) continue;
    const key = normalizeCodeKey(display);
    if (!key) continue;
    const priority = Number(entry.providerPriority ?? providerVotePriority(entry.provider));
    vote(entry.status === "active" ? activeVote : notWorkingVote, key, providerVotePriority(entry.provider));
    incoming.push({ key, display, entry, priority });
  }

  const expiredArray = new Map<string, { display: string; priority: number }>();
  const setExpired = (display: string, priority: number) => {
    const cleaned = stripPastedCopySuffix(display);
    const key = cleaned ? normalizeCodeKey(cleaned) : null;
    if (!cleaned || !key) return;
    const existing = expiredArray.get(key);
    if (!existing || priority > existing.priority) {
      expiredArray.set(key, { display: cleaned, priority });
    }
  };

  for (const display of input.existingExpiredCodes) setExpired(display, -1);

  for (const raw of input.expiredCodes) {
    const display = stripPastedCopySuffix(typeof raw === "string" ? raw : raw?.code);
    if (!display) continue;
    const key = normalizeCodeKey(display);
    if (!key) continue;
    const priority = providerVotePriority(typeof raw === "string" ? undefined : raw?.provider);
    vote(notWorkingVote, key, priority);
    setExpired(display, priority);
  }

  const isActive = (key: string) => (activeVote.get(key) ?? -1) > (notWorkingVote.get(key) ?? -1);

  const stored = new Map<string, StoredCodeRow>();
  for (const row of input.existingRows) {
    const key = normalizeCodeKey(row.code);
    if (!key) continue;
    const current = stored.get(key);
    if (current && current.providerPriority >= row.providerPriority) continue;
    stored.set(key, row);
  }

  const upserts: CodeRefreshUpsert[] = [];
  const touch: string[] = [];
  const listedActive = new Set<string>();
  let newCodes = 0;

  // Oldest entries first, so the newest code gets the latest first_seen_at.
  for (let i = incoming.length - 1; i >= 0; i -= 1) {
    const { key, display, entry, priority } = incoming[i];
    const status = isActive(key) ? "active" : "expired";

    if (status === "active") {
      const existing = stored.get(key);
      // upsert_code ignores a status from a lower provider priority, so a stored
      // expired or "check" row with a higher priority stays not working. Keep it
      // in expired_codes so the two stores agree.
      const reactivationRejected =
        existing != null && existing.status !== "active" && existing.providerPriority > priority;
      if (!reactivationRejected) {
        listedActive.add(key);
        expiredArray.delete(key);
      }
      if (
        existing?.status === "active" &&
        (existing.providerPriority > priority ||
          (existing.providerPriority === priority && existing.code === display))
      ) {
        touch.push(existing.code);
        continue;
      }
      if (entry.isNew) newCodes += 1;
    }

    upserts.push({
      code: display,
      status,
      rewardsText: entry.rewardsText ?? null,
      levelRequirement: entry.levelRequirement ?? null,
      isNew: status === "active" && Boolean(entry.isNew),
      providerPriority: priority,
    });
  }

  const convertCheck: string[] = [];
  const expire: string[] = [];
  let expiredByVote = 0;
  let expiredAsMissing = 0;
  for (const row of input.existingRows) {
    const key = normalizeCodeKey(row.code);
    if (!key) continue;
    if (row.status === "check") {
      // Every stored "check" row is queued. The update runs after the upserts and
      // only touches rows still marked "check", so a row its upsert reactivated
      // stays active, and one whose reactivation the RPC rejected (lower
      // priority than the stored row) is expired instead of staying "check".
      convertCheck.push(row.code);
      if (!listedActive.has(key)) setExpired(row.code, 0);
      continue;
    }
    if (row.status !== "active" || listedActive.has(key)) continue;
    if (notWorkingVote.has(key)) {
      expire.push(row.code);
      expiredByVote += 1;
      setExpired(row.code, 0);
    } else if (!input.hasSourceFailures) {
      expire.push(row.code);
      expiredAsMissing += 1;
      setExpired(row.code, 0);
    }
  }

  return {
    upserts,
    touch,
    convertCheck,
    expire,
    expiredByVote,
    expiredAsMissing,
    expiredCodes: Array.from(expiredArray.values()).map((entry) => entry.display),
    newCodes,
  };
}
