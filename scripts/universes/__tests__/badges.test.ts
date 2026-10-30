import assert from "node:assert/strict";
import test from "node:test";
import { fetchRefreshBadges, refreshBadges, saveRefreshBadges, type RefreshBadge } from "../badges";
import { PassRefreshDeferredError } from "../game-pass-http";
import { listHotAttachmentUniverseIds, ATTACHMENT_HOT_CAP } from "../attachment-refresh-scope";
import { runStatsBadgeRefresh } from "../refresh-stats-badges";
import { runWikiGamePassRefresh } from "../refresh-wiki-game-passes";

const badge = (id: number): RefreshBadge => ({ id, name: `Badge ${id}`, enabled: true, statistics: { winRatePercentage: .066, awardedCount: 100, pastDayAwardedCount: 2 } });
function database(existing: number[] = [], options: { failWrite?: boolean; wikiIds?: number[]; hotIds?: number[]; storedRows?: Array<Record<string, unknown> & { badge_id: number }> } = {}) {
  const writes: any[] = [], deletes: number[][] = [];
  const stored = new Map((options.storedRows ?? []).map(row => [row.badge_id, { ...row }]));
  const calls: Array<{ table: string; op: string; value: unknown }> = [];
  return { writes, deletes, calls, stored, from(table: string) {
    let mode = 'read', after = 0, afterSlug = '', selected: unknown;
    const chain: any = {
      select(value: unknown) { selected = value; calls.push({ table, op: 'select', value }); return chain; },
      eq(key: string, value: unknown) { calls.push({ table, op: key, value }); return chain; },
      not() { return chain; },
      gt(key: string, value: any) { if (key === 'slug') afterSlug = value; else after = value; return chain; },
      order(key: string, value: unknown) { calls.push({ table, op: `order:${key}`, value }); return chain; },
      limit(value: number) { calls.push({ table, op: 'limit', value }); return chain; },
      upsert(rows: Array<Record<string, unknown> & { badge_id: number }>, upsertOptions: { defaultToNull: boolean }) {
        mode = 'upsert';
        writes.push(rows);
        if (!options.failWrite) {
          assert.equal(upsertOptions.defaultToNull, false);
          for (const row of rows) stored.set(row.badge_id, { ...stored.get(row.badge_id), ...row });
        }
        return chain;
      },
      delete() { mode = 'delete'; return chain; },
      in(_key: string, ids: number[]) { deletes.push(ids); return chain; },
      then(resolve: (value: unknown) => unknown) {
        if (mode === 'upsert') return Promise.resolve(resolve({ data: null, error: options.failWrite ? new Error('write failed') : null }));
        if (mode === 'delete') return Promise.resolve(resolve({ data: null, error: null }));
        const data = table === 'wiki_pages' ? afterSlug ? [] : (options.wikiIds ?? []).map((id, i) => ({ slug: `wiki-${i}`, universe_id: id })) :
          table === 'roblox_universes' ? (options.hotIds ?? []).map(id => ({ universe_id: id })) :
          selected === 'badge_id' ? existing.filter(id => id > after).map(id => ({ badge_id: id })) : [];
        return Promise.resolve(resolve({ data, error: null }));
      }
    };
    return chain;
  } };
}

test("badge pagination fetches a complete roster and keeps raw fraction units", async () => {
  let page = 0;
  const rows = await fetchRefreshBadges(10, async url => {
    page++;
    if (page === 2) assert.match(url, /cursor=next/);
    return page === 1 ? { data: [badge(1)], nextPageCursor: 'next' } : { data: [badge(2)], nextPageCursor: null };
  });
  assert.equal(rows.length, 2);
  const db = database([1, 3]);
  await saveRefreshBadges(db as any, 10, rows, '2026-10-25T00:00:00Z');
  assert.equal(db.writes[0][0].rarity_percent, .066);
  assert.equal(db.writes[0][0].stats_updated_at, '2026-10-25T00:00:00Z');
  assert.equal('icon_image_url' in db.writes[0][0], false);
  assert.deepEqual(db.deletes, [[3]]);
});

test("a second-page failure or repeated cursor never writes or deletes stored badges", async () => {
  for (const repeated of [false, true]) {
    const db = database([3]);
    let page = 0;
    const result = await refreshBadges(db as any, [10], { shouldStop: () => false, fetchJson: async () => {
      page++;
      if (page === 2 && !repeated) throw new Error('partial failure');
      return { data: [badge(page)], nextPageCursor: 'same' };
    } });
    assert.deepEqual(result.failed, [10]);
    assert.deepEqual(db.writes, []);
    assert.deepEqual(db.deletes, []);
  }
});

test("a failed upsert never prunes, and absent stats preserve stored values", async () => {
  const fail = database([5], { failWrite: true });
  await assert.rejects(saveRefreshBadges(fail as any, 10, [badge(1)]), /write failed/);
  assert.deepEqual(fail.deletes, []);
  const db = database();
  await saveRefreshBadges(db as any, 10, [badge(1), { ...badge(2), statistics: undefined }]);
  assert.equal(db.writes.length, 2); // Different sparse field sets.
  assert.equal('rarity_percent' in db.writes[1][0], false);
  assert.equal('stats_updated_at' in db.writes[1][0], false);
});

test("refresh preserves populated metadata when another badge supplies omitted fields", async () => {
  const metadata = {
    badge_id: 1, description: 'Keep this description',
    created_at_api: '2020-01-01T00:00:00Z', updated_at_api: '2026-10-01T00:00:00Z'
  };
  const db = database([1, 2], { storedRows: [metadata] });
  await saveRefreshBadges(db as any, 10, [
    badge(1),
    { ...badge(2), description: 'New description', created: '2022-01-01T00:00:00Z', updated: '2026-10-24T00:00:00Z' }
  ]);
  assert.equal(db.writes.length, 2); // Sparse metadata must not share an upsert field set.
  for (const field of ['description', 'created_at_api', 'updated_at_api']) {
    assert.equal(field in db.writes[0][0], false);
    assert.equal(db.stored.get(1)?.[field], metadata[field as keyof typeof metadata]);
  }
  assert.equal(db.stored.get(2)?.description, 'New description');
  // A present empty description is a real update, not an omitted field.
  await saveRefreshBadges(db as any, 10, [{ ...badge(1), description: '' }, badge(2)]);
  assert.equal(db.stored.get(1)?.description, '');
  assert.equal(db.stored.get(1)?.created_at_api, metadata.created_at_api);
});

test("empty complete roster prunes, malformed or oversized roster does not", async () => {
  await assert.rejects(fetchRefreshBadges(10, async () => ({ data: [badge(1)] })), /Malformed badges/);
  const db = database([1]);
  const result = await refreshBadges(db as any, [10], { shouldStop: () => false, fetchJson: async () => ({ data: [], nextPageCursor: null }) });
  assert.deepEqual(result.refreshed, [10]);
  assert.deepEqual(db.deletes, [[1]]);
  await assert.rejects(fetchRefreshBadges(10, async () => ({ data: [{}], nextPageCursor: null })), /Invalid badge/);
  let count = 0;
  await assert.rejects(fetchRefreshBadges(10, async () => ({ data: [badge(++count)], nextPageCursor: String(count) })), PassRefreshDeferredError);
  assert.equal(count, 10);
});

test("deadline leaves unfinished and unstarted universes deferred, without pruning", async () => {
  const db = database([1]);
  let stopped = false;
  const result = await refreshBadges(db as any, [10, 11, 12], { shouldStop: () => stopped, fetchJson: async () => { stopped = true; return { data: [badge(1)], nextPageCursor: null }; } });
  assert.deepEqual(result.deferred.sort(), [10, 11, 12]);
  assert.deepEqual(db.deletes, []);
});

test("HOT scope is capped and ordered using the tier/player index", async () => {
  const db = database([], { hotIds: [7, 8] });
  assert.deepEqual(await listHotAttachmentUniverseIds(db as any), [7, 8]);
  assert.ok(db.calls.some(c => c.op === 'stats_tier' && c.value === 'HOT'));
  assert.ok(db.calls.some(c => c.op === 'limit' && c.value === ATTACHMENT_HOT_CAP));
});

test("badge ledger records combined deduplicated scope, deferred IDs and releases its lease", async () => {
  const db = database([], { wikiIds: [1, 2], hotIds: [2, 3] });
  const events: string[] = [];
  let finished: any;
  const result = await runStatsBadgeRefresh({
    database: () => db as any,
    claimLease: async () => { events.push('claim'); return true; }, releaseLease: async () => { events.push('release'); },
    startRun: async () => { events.push('start'); return { id: 'run', jobName: 'stats_badges_refresh', startedAt: 'now', metadata: {} }; },
    finishRun: async (_run, input) => { events.push('finish'); finished = input; },
    http: () => ({ shouldStop: () => true, fetchJson: async () => { throw new Error('must not fetch'); }, requestCount: 0, stoppedReason: 'run_deadline' })
  });
  assert.deepEqual(result?.deferred, [1, 2, 3]);
  assert.deepEqual(events, ['claim', 'start', 'finish', 'release']);
  assert.equal(finished.status, 'partial');
  assert.equal(finished.rowsClaimed, 3);
  assert.equal(finished.metadata.hot_cap, 100);
  assert.equal(finished.metadata.request_cap, 400);
});

test("pass refresh HOT option includes HOT games without changing wiki-only default", async () => {
  for (const includeHot of [false, true]) {
    const db = database([], { wikiIds: [1, 2], hotIds: [2, 3] });
    let finished: any;
    await runWikiGamePassRefresh({ database: () => db as any, claimLease: async () => true, releaseLease: async () => {},
      startRun: async () => ({ id: 'run', jobName: 'wiki_game_passes_refresh', startedAt: 'now', metadata: {} }),
      finishRun: async (_run, input) => { finished = input; },
      http: () => ({ shouldStop: () => true, fetchJson: async () => ({}), requestCount: 0, stoppedReason: 'run_deadline' })
    }, { includeHot });
    assert.equal(finished.rowsClaimed, includeHot ? 3 : 2);
    assert.equal(finished.metadata.scope, includeHot ? 'published_wikis_and_hot' : 'published_wikis');
  }
});

test("badge lease releases and ledger fails when target enumeration fails", async () => {
  let released = false, status: unknown;
  await assert.rejects(runStatsBadgeRefresh({
    database: () => ({ from: () => { throw new Error('enumeration failed'); } }) as any,
    claimLease: async () => true, releaseLease: async () => { released = true; },
    startRun: async () => ({ id: 'run', jobName: 'stats_badges_refresh', startedAt: 'now', metadata: {} }),
    finishRun: async (_run, input) => { status = input.status; },
    http: () => ({ shouldStop: () => false, fetchJson: async () => ({}), requestCount: 0, stoppedReason: null })
  }), /enumeration failed/);
  assert.equal(released, true);
  assert.equal(status, 'failed');
});
