import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";

function isLocalSupabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  const hostname = new URL(value).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log("Usage: npm run catalog:free-items-main-only -- [--apply] [--allow-prod]");
    return;
  }
  const apply = process.argv.includes("--apply");
  const allowProd = process.argv.includes("--allow-prod");
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE");
  }
  if (apply && !allowProd && !isLocalSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error("Refusing to update non-local Supabase without --allow-prod");
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("catalog_pages")
    .select("code,title,is_published")
    .or("code.like.free-roblox-items/%,code.like.roblox-free-items/%")
    .order("code");
  if (error) throw error;

  const published = (data ?? []).filter((row) => row.is_published === true);
  console.log(`Found ${data?.length ?? 0} Free Items sub-catalog rows; ${published.length} are published.`);
  for (const row of published) console.log(`- ${row.code} | ${row.title}`);

  if (!apply || !published.length) {
    console.log(apply ? "No published sub-catalog rows required an update." : "Dry run only. Pass --apply to unpublish them.");
    return;
  }

  const { error: updateError } = await sb
    .from("catalog_pages")
    .update({ is_published: false, published_at: null })
    .in("code", published.map((row) => row.code));
  if (updateError) throw updateError;
  console.log(`Unpublished ${published.length} Free Items sub-catalog rows. The main catalog row was unchanged.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
