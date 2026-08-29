import "../shared/load-env";

import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { resolveWikiDevCredentials } from "./wiki-automation-env";

async function main() {
  if (!process.argv.includes("--apply")) {
    console.log("Usage: npm run wiki:queue:check -- --apply");
    return;
  }
  const dev = resolveWikiDevCredentials();
  const sb = createClient(dev.url, dev.serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const marker = `queue-contract-${randomUUID()}`;
  const universeBase = 8_000_000_000_000_000 + randomInt(1_000_000);
  const ids: string[] = [];
  try {
    for (let index = 0; index < 2; index += 1) {
      const inserted = await sb.from("wiki_generation_queue").insert({
        universe_id: universeBase + index,
        root_place_id: universeBase + 100 + index,
        game_name: `${marker}-${index}`,
        wiki_slug: `${marker}-${index}`,
        rank_at_claim: 99 + index,
        status: "queued"
      }).select("id").single();
      if (inserted.error) throw inserted.error;
      ids.push(inserted.data.id);
    }
    const claims = await Promise.all([
      sb.rpc("claim_wiki_generation_queue_item", { p_worker: `${marker}-a`, p_lease_minutes: 30 }),
      sb.rpc("claim_wiki_generation_queue_item", { p_worker: `${marker}-b`, p_lease_minutes: 30 })
    ]);
    if (claims.some((claim) => claim.error)) throw claims.find((claim) => claim.error)!.error;
    const rows = claims.flatMap((claim) => Array.isArray(claim.data) ? claim.data : claim.data ? [claim.data] : []);
    if (rows.length !== 1) throw new Error(`Concurrent claim expected one row; received ${rows.length}.`);
    const row = rows[0] as { id: string; lease_token: string };
    const wrong = await sb.rpc("heartbeat_wiki_generation_queue_item", {
      p_id: row.id,
      p_lease_token: randomUUID(),
      p_lease_minutes: 30
    });
    const correct = await sb.rpc("heartbeat_wiki_generation_queue_item", {
      p_id: row.id,
      p_lease_token: row.lease_token,
      p_lease_minutes: 30
    });
    if (wrong.error || wrong.data !== false) throw new Error("Wrong-token heartbeat was not rejected.");
    if (correct.error || correct.data !== true) throw new Error("Correct-token heartbeat failed.");
    console.log("Wiki queue contract passed: one global claim and token-bound heartbeat.");
  } finally {
    if (ids.length) {
      const cleanup = await sb.from("wiki_generation_queue").delete().in("id", ids);
      if (cleanup.error) console.error(`Queue contract cleanup failed: ${cleanup.error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
