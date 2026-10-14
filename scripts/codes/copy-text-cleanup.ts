import {
  cleanExpiredCodeList,
  normalizeCodeKey,
  sanitizeCodeDisplay,
  stripPastedCopySuffix,
  stripTrailingCopyButtonText,
} from "@/lib/code-normalization";

export type CleanupCodeRow = {
  id: string;
  code_page_id: string;
  code: string;
  status: "active" | "expired" | "check";
  rewards_text: string | null;
  level_requirement: number | null;
  is_new: boolean | null;
  first_seen_at: string;
  last_seen_at: string;
  posted_online: boolean;
  provider_priority: number;
};

export type CleanupCodePage = {
  id: string;
  slug: string;
  expired_codes: string[] | null;
};

type CleanupGroup = {
  survivor: CleanupCodeRow;
  patch: Partial<CleanupCodeRow>;
  deleteIds: string[];
};

function statusRank(status: CleanupCodeRow["status"]): number {
  if (status === "active") return 2;
  if (status === "check") return 1;
  return 0;
}

export function buildCopyCleanupPlan(rows: CleanupCodeRow[], pages: CleanupCodePage[]) {
  const dirtyCodeRows = rows.filter(
    (row) => stripPastedCopySuffix(row.code) !== sanitizeCodeDisplay(row.code)
  );
  const dirtyIds = new Set(dirtyCodeRows.map((row) => row.id));
  const rowsByCleanKey = new Map<string, CleanupCodeRow[]>();
  for (const row of rows) {
    const normalized = normalizeCodeKey(stripPastedCopySuffix(row.code));
    if (!normalized) continue;
    const key = `${row.code_page_id}:${normalized}`;
    const members = rowsByCleanKey.get(key) ?? [];
    members.push(row);
    rowsByCleanKey.set(key, members);
  }

  const groups: CleanupGroup[] = [];
  const groupedIds = new Set<string>();
  for (const members of rowsByCleanKey.values()) {
    if (!members.some((row) => dirtyIds.has(row.id))) continue;

    const ranked = [...members].sort(
      (left, right) =>
        right.provider_priority - left.provider_priority ||
        statusRank(right.status) - statusRank(left.status)
    );
    // Retain a clean row's ID and spelling when a twin already exists.
    const survivor = ranked.find((row) => !dirtyIds.has(row.id)) ?? ranked[0];
    const priorityRows = [...members].sort(
      (left, right) => right.provider_priority - left.provider_priority
    );
    const rewardSource = priorityRows.find((row) =>
      Boolean(stripTrailingCopyButtonText(row.rewards_text))
    );
    const levelSource = priorityRows.find((row) => row.level_requirement != null);
    const mergedStatus = [...members].sort(
      (left, right) => statusRank(right.status) - statusRank(left.status)
    )[0].status;
    const firstSeen = members.map((row) => row.first_seen_at)
      .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
    const lastSeen = members.map((row) => row.last_seen_at)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0];

    groups.push({
      survivor,
      patch: {
        // Keep a clean survivor's exact spelling so the case-insensitive unique
        // index cannot collide with another clean variant before duplicates go.
        code: dirtyIds.has(survivor.id) ? stripPastedCopySuffix(survivor.code)! : survivor.code,
        status: mergedStatus,
        rewards_text: stripTrailingCopyButtonText(rewardSource?.rewards_text),
        level_requirement: levelSource?.level_requirement ?? null,
        is_new: members.some((row) => row.is_new),
        first_seen_at: firstSeen,
        last_seen_at: lastSeen,
        posted_online: members.some((row) => row.posted_online),
        provider_priority: Math.max(...members.map((row) => row.provider_priority)),
      },
      deleteIds: members.filter((row) => row.id !== survivor.id).map((row) => row.id),
    });
    members.forEach((row) => groupedIds.add(row.id));
  }

  const dirtyRewardRows = rows.filter(
    (row) => stripTrailingCopyButtonText(row.rewards_text) !== sanitizeCodeDisplay(row.rewards_text)
  );
  // Group patches already choose and clean the merged reward. Do not overwrite it
  // afterward with the survivor's older, lower-priority reward.
  const rewardUpdates = dirtyRewardRows.filter((row) => !groupedIds.has(row.id)).map((row) => ({
    id: row.id,
    rewards_text: stripTrailingCopyButtonText(row.rewards_text),
  }));

  const expiredUpdates = pages.flatMap((page) => {
    const cleaned = cleanExpiredCodeList(page.expired_codes ?? []);
    return cleaned.removed || cleaned.renamed
      ? [{ id: page.id, slug: page.slug, expired_codes: cleaned.codes, removed: cleaned.removed, renamed: cleaned.renamed }]
      : [];
  });

  const breakdown = pages.map((page) => ({
    id: page.id,
    slug: page.slug,
    codesRenamed: groups.filter((group) => group.survivor.code_page_id === page.id && group.patch.code !== group.survivor.code).length,
    codesMerged: groups.filter((group) => group.survivor.code_page_id === page.id).reduce((sum, group) => sum + group.deleteIds.length, 0),
    rewardsCleaned: dirtyRewardRows.filter((row) => row.code_page_id === page.id).length,
    expiredRemoved: expiredUpdates.find((update) => update.id === page.id)?.removed ?? 0,
    expiredRenamed: expiredUpdates.find((update) => update.id === page.id)?.renamed ?? 0,
  })).filter((page) => page.codesRenamed || page.codesMerged || page.rewardsCleaned || page.expiredRemoved || page.expiredRenamed);

  return { dirtyCodeRows, dirtyRewardRows, groups, rewardUpdates, expiredUpdates, breakdown };
}
