import "../shared/load-env";
import { readEntry, upsertEntry } from "../content/verify-simple-page-finals";
import { supabaseAdmin } from "@/lib/supabase-admin";
async function main() {
const args = process.argv.slice(2);
const file = args[args.indexOf("--file") + 1];
if (!file) throw new Error("Select an exact events final.");
const entry = await readEntry(file);
if (entry.kind !== "event") throw new Error("Expected an events final.");
const { data: existing, error } = await supabaseAdmin().from("events_pages").select("slug").eq("universe_id",entry.row.universe_id).maybeSingle();
if (error || existing && existing.slug !== entry.slug) throw new Error("Events identity readback mismatch.");
if (!args.includes("--apply")) console.log(`Validated selected events page ${entry.slug}.`);
else {
  await upsertEntry(entry);
  const { data, error } = await supabaseAdmin().from("events_pages").select("slug,title,content_md,is_published").eq("universe_id", entry.row.universe_id).single();
  if (error || data.slug !== entry.slug || data.title !== entry.title || data.content_md !== entry.row.content_md || data.is_published !== (entry.row.is_published ?? true)) throw new Error("Events publication readback failed.");
}

}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
