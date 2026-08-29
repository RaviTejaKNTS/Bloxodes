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
    for (let index = 0; index < 4; index += 1) {
      const inserted = await sb.from("wiki_generation_queue").insert({
        universe_id: universeBase + index,
        root_place_id: universeBase + 100 + index,
        game_name: `${marker}-${index}`,
        wiki_slug: `${marker}-${index}`,
        rank_at_claim: 97 + index,
        status: "queued"
      }).select("id").single();
      if (inserted.error) throw inserted.error;
      ids.push(inserted.data.id);
    }
    const claims = await Promise.all([
      sb.rpc("claim_wiki_generation_queue_item", { p_worker: `${marker}-a`, p_lease_minutes: 30, p_queue_id: ids[0] }),
      sb.rpc("claim_wiki_generation_queue_item", { p_worker: `${marker}-b`, p_lease_minutes: 30, p_queue_id: ids[1] })
    ]);
    if (claims.some((claim) => claim.error)) throw claims.find((claim) => claim.error)!.error;
    const rows = claims.flatMap((claim) => Array.isArray(claim.data) ? claim.data : claim.data ? [claim.data] : []);
    if (rows.length !== 2) throw new Error(`Concurrent claim expected two rows; received ${rows.length}.`);
    const slots = rows.map((row) => Number((row as { processing_slot: unknown }).processing_slot)).sort();
    if (slots.join(",") !== "1,2") throw new Error(`Concurrent claims used unexpected slots: ${slots.join(",")}.`);
    const claimedIds = new Set(rows.map((row) => String((row as { id: unknown }).id)));
    if (!claimedIds.has(ids[0]) || !claimedIds.has(ids[1])) throw new Error("Targeted claims leased an unexpected queue row.");
    const blockedThird = await sb.rpc("claim_wiki_generation_queue_item", {
      p_worker: `${marker}-c`,
      p_lease_minutes: 30,
      p_queue_id: ids[2]
    });
    if (blockedThird.error) throw blockedThird.error;
    if (Array.isArray(blockedThird.data) ? blockedThird.data.length : Boolean(blockedThird.data)) {
      throw new Error("A third queue claim bypassed the two-slot limit.");
    }
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

    const expiredId = ids[0];
    const expired = await sb.from("wiki_generation_queue").update({
      lease_expires_at: new Date(Date.now() - 60_000).toISOString()
    }).eq("id", expiredId).eq("status", "processing");
    if (expired.error) throw expired.error;
    const replacement = await sb.rpc("claim_wiki_generation_queue_item", {
      p_worker: `${marker}-c`,
      p_lease_minutes: 30,
      p_queue_id: ids[2]
    });
    if (replacement.error) throw replacement.error;
    const replacementRows = Array.isArray(replacement.data) ? replacement.data : replacement.data ? [replacement.data] : [];
    if (replacementRows.length !== 1 || replacementRows[0].id !== ids[2]) throw new Error("Expired lease did not free a slot for the targeted replacement.");
    const recovered = await sb.from("wiki_generation_queue")
      .select("status,lease_token,lease_owner,lease_expires_at,processing_slot")
      .eq("id", expiredId)
      .single();
    if (recovered.error) throw recovered.error;
    if (recovered.data.status !== "retry" || recovered.data.lease_token || recovered.data.lease_owner || recovered.data.lease_expires_at || recovered.data.processing_slot) {
      throw new Error("Expired lease was not returned to retry with its lease and slot cleared.");
    }

    const maxAttemptId = ids[1];
    const maxAttempt = await sb.from("wiki_generation_queue").update({
      attempts: 3,
      lease_expires_at: new Date(Date.now() - 60_000).toISOString()
    }).eq("id", maxAttemptId).eq("status", "processing");
    if (maxAttempt.error) throw maxAttempt.error;
    const finalReplacement = await sb.rpc("claim_wiki_generation_queue_item", {
      p_worker: `${marker}-d`,
      p_lease_minutes: 30,
      p_queue_id: ids[3]
    });
    if (finalReplacement.error) throw finalReplacement.error;
    const finalRows = Array.isArray(finalReplacement.data) ? finalReplacement.data : finalReplacement.data ? [finalReplacement.data] : [];
    if (finalRows.length !== 1 || finalRows[0].id !== ids[3]) throw new Error("Max-attempt expiry did not free a slot.");
    const failed = await sb.from("wiki_generation_queue")
      .select("status,lease_token,lease_owner,lease_expires_at,processing_slot")
      .eq("id", maxAttemptId)
      .single();
    if (failed.error) throw failed.error;
    if (failed.data.status !== "failed" || failed.data.lease_token || failed.data.lease_owner || failed.data.lease_expires_at || failed.data.processing_slot) {
      throw new Error("Expired max-attempt lease was not failed with its lease and slot cleared.");
    }
    console.log("Wiki queue contract passed: two targeted claims, blocked third claim, token heartbeat, lease recovery, slot reuse, and max-attempt failure.");
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
