import assert from "node:assert/strict";
import test from "node:test";
import { acknowledgeCatalogRefreshFromStats } from "../catalog-refresh-ack";

test("verified stats settle only unclaimed catalog work older than the observation", async () => {
  const observed = "2026-10-02T10:00:00.000Z";
  const tasks = [
    {asset_id:1,status:"pending",last_attempt_at:null},
    {asset_id:2,status:"processing",last_attempt_at:observed},
    {asset_id:3,status:"retry",last_attempt_at:"2026-10-02T11:00:00.000Z"},
    {asset_id:4,status:"pending",last_attempt_at:null}
  ];
  const client = { from() {
    let patch: any; const filters: Array<(row: any) => boolean> = [];
    const builder: any = {
      update(value: any) {patch=value;return builder;},
      in(key: string, values: any[]) {filters.push(row=>values.includes(row[key]));return builder;},
      or() {filters.push(row=>row.last_attempt_at===null||row.last_attempt_at<=observed);return builder;},
      then(resolve: any) {tasks.filter(row=>filters.every(f=>f(row))).forEach(row=>Object.assign(row,patch));return Promise.resolve({error:null}).then(resolve);}
    }; return builder;
  }};
  const rows = tasks.map(row=>({asset_id:row.asset_id,last_metadata_verified_at:observed,
    last_thumbnail_verified_at:row.asset_id===4?null:observed,next_item_stats_refresh_at:"2026-10-23T10:00:00.000Z"}));
  await acknowledgeCatalogRefreshFromStats(client as any,rows);
  assert.equal((tasks[0] as any).last_success_at,observed);
  for(const task of tasks.slice(1)) assert.equal((task as any).last_success_at,undefined);
});
