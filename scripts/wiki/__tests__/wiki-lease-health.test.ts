import assert from "node:assert/strict";
import test from "node:test";
import { guardWikiHeartbeat, WikiLeaseLostError, reconcileExpiredWikiLeases } from "../wiki-lease-health";

test("a lost lease aborts immediately, while a transient failure can recover", async () => {
  let attempt = 0;
  const guard = guardWikiHeartbeat(async () => { if (++attempt === 1) throw new Error("network failure"); }, 60_000);
  try { await guard.tick(); assert.equal(guard.signal.aborted, false); await guard.tick(); assert.equal(guard.signal.aborted, false); }
  finally { guard.stop(); }
  const lost = guardWikiHeartbeat(async () => { throw new WikiLeaseLostError("lost"); });
  try { await lost.tick(); assert.equal(lost.signal.aborted, true); }
  finally { lost.stop(); }
});

test("three consecutive failed heartbeats stop work", async () => {
  const guard = guardWikiHeartbeat(async () => { throw new Error("offline"); });
  try { await guard.tick(); await guard.tick(); assert.equal(guard.signal.aborted, false); await guard.tick(); assert.equal(guard.signal.aborted, true); }
  finally { guard.stop(); }
});

test("expired processing rows recover, but a concurrent renewal and owner holds remain intact", async () => {
  const rows = [
    {id:"orphan", status:"processing", lease_token:"a", lease_expires_at:"2026-10-01",attempts:1,max_attempts:3},
    {id:"renewed", status:"processing", lease_token:"b", lease_expires_at:"2026-10-01",attempts:1,max_attempts:3},
    {id:"held", status:"blocked", lease_token:null, lease_expires_at:null,attempts:1,max_attempts:3}
  ];
  let first = true;
  const client = { from() {
    const filters: Array<(row: any) => boolean> = []; let update: any;
    const builder: any = {
      select() { return builder; }, limit() { return builder; },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return builder; },
      lt(key: string, value: string) { filters.push(row => row[key] !== null && row[key] < value); return builder; },
      update(value: unknown) { update = value; return builder; },
      then(resolve: (value: unknown) => unknown) {
        const selected = rows.filter(row => filters.every(filter => filter(row)));
        const copy = selected.map(row => ({...row}));
        if (update) selected.forEach(row => Object.assign(row, update));
        if (first) { first = false; rows[1].lease_expires_at = "2026-10-04"; }
        return Promise.resolve({data:copy,error:null}).then(resolve);
      }
    }; return builder;
  }};
  assert.equal(await reconcileExpiredWikiLeases(client as any, new Date("2026-10-02")), 1);
  assert.equal(rows[0].status,"retry"); assert.equal(rows[1].status,"processing"); assert.equal(rows[2].status,"blocked");
});
