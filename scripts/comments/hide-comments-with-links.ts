import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { detectCommentLink, type CommentLinkMatch } from "@/lib/comment-links";
import { isManagedDevelopmentSupabaseUrl, isProductionSupabaseUrl } from "../shared/supabase-target";

// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE from the selected env profile.
// Comment UPDATE triggers queue page revalidation and Cloudflare purges.
// getCommentsTag is a Next runtime tag; standalone scripts cannot revalidate it.
// Public comment reads use publicContentCache, which currently calls the loader directly.
const PAGE_SIZE = 500;
const argv = new Set(process.argv.slice(2));
const apply = argv.has("--apply");
const allowProd = argv.has("--allow-prod");

type CommentRow = {
  id: string;
  created_at: string;
  updated_at: string;
  entity_type: string;
  entity_id: string;
  page_url: string | null;
  status: "pending" | "approved" | "rejected" | "deleted";
  body_md: string | null;
  guest_name: string | null;
  moderation: unknown;
};

type Match = CommentLinkMatch & { field: "body_md" | "guest_name" };

async function main() {
  if (argv.has("--help") || argv.has("-h")) {
    console.log("Usage: npm run comments:hide-links -- [--apply] [--allow-prod]");
    return;
  }
  for (const arg of argv) {
    if (!["--apply", "--allow-prod"].includes(arg)) throw new Error(`Unknown option: ${arg}`);
  }

  const managed = isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL);
  const production = isProductionSupabaseUrl(process.env.SUPABASE_URL);
  if (!managed && !production) throw new Error("Unrecognized Supabase target.");
  if (production && (!allowProd || process.env.NODE_ENV !== "production")) {
    throw new Error("Production reads and writes require NODE_ENV=production and --allow-prod.");
  }
  if (allowProd && !production) throw new Error("--allow-prod requires the recognized production target.");
  if (!process.env.SUPABASE_SERVICE_ROLE) throw new Error("Missing SUPABASE_SERVICE_ROLE.");

  const admin = supabaseAdmin();
  let cursor: string | null = null;
  let scanned = 0;
  let matched = 0;
  let eligible = 0;
  let hidden = 0;
  let changed = 0;
  const affectedEntities = new Set<string>();
  console.log(`${apply ? "Apply" : "Dry run"} against ${production ? "production" : "managed development"}.`);

  while (true) {
    let query = admin.from("comments")
      .select("id,created_at,updated_at,entity_type,entity_id,page_url,status,body_md,guest_name,moderation")
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as CommentRow[];

    for (const row of rows) {
      scanned += 1;
      const matches: Match[] = [];
      for (const field of ["body_md", "guest_name"] as const) {
        const match = detectCommentLink(row[field] ?? "");
        if (match) matches.push({ field, ...match });
      }
      if (!matches.length) continue;
      matched += 1;
      console.log(JSON.stringify({
        id: row.id,
        created_at: row.created_at,
        page_url: row.page_url,
        status: row.status,
        matches,
        body: (row.body_md ?? "").replace(/\s+/g, " ").slice(0, 160)
      }));
      if (row.status !== "approved" && row.status !== "pending") continue;
      eligible += 1;
      if (!apply) continue;

      const prior = row.moderation && typeof row.moderation === "object" && !Array.isArray(row.moderation)
        ? row.moderation as Record<string, unknown>
        : row.moderation === null ? {} : { previous_moderation: row.moderation };
      const moderation = {
        ...prior,
        comment_link_cleanup: {
          reason: "links_not_allowed",
          matches,
          previous_status: row.status,
          hidden_at: new Date().toISOString()
        }
      };
      // Keep newer edits or moderation decisions if a row changed during this scan.
      const result = await admin.from("comments")
        .update({ status: "rejected", moderation })
        .eq("id", row.id)
        .eq("status", row.status)
        .eq("updated_at", row.updated_at)
        .select("id,status,moderation");
      if (result.error) throw result.error;
      if (!result.data?.length) {
        changed += 1;
        console.log(`Skipped changed comment ${row.id}; rerun to review it.`);
        continue;
      }
      if (result.data[0].status !== "rejected") throw new Error(`Hide readback failed for ${row.id}.`);
      hidden += 1;
      affectedEntities.add(`comments:${row.entity_type}:${row.entity_id}`);
    }

    if (rows.length < PAGE_SIZE) break;
    cursor = rows[rows.length - 1].id;
  }

  console.log(`Scanned ${scanned} comments; matched ${matched}; eligible to hide ${eligible}; hidden ${hidden}; changed during scan ${changed}.`);
  console.log(apply
    ? `Page revalidation was queued by comment UPDATE triggers for ${affectedEntities.size} affected entities. No standalone Next tag call was made.`
    : "Dry run complete; no rows were changed.");
}

main().catch((error: unknown) => {
  console.error("Comment link cleanup failed", error);
  process.exitCode = 1;
});
