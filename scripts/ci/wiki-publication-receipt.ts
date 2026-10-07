import { createClient } from "@supabase/supabase-js";

export async function wikiPublicationReceipt(ticket: any, urls?: string[]) {
  if (!ticket) return;
  if (!/^[0-9a-f-]{36}$/i.test(ticket.queueId ?? "") || typeof ticket.requestId !== "string" || !ticket.requestId.startsWith(`${ticket.queueId}-`)) throw new Error("Invalid exact wiki publication ticket.");
  if (process.env.ARTICLE_DEV_SUPABASE_URL !== "https://bbtcaurrtyoukvjbxbbj.supabase.co") throw new Error("Unexpected queue project.");
  const db = createClient(process.env.ARTICLE_DEV_SUPABASE_URL, process.env.ARTICLE_DEV_SUPABASE_SERVICE_ROLE!, { auth: { persistSession: false } });
  const { data: row, error } = await db.from("wiki_generation_queue").select("status,lease_token,lease_expires_at,production_receipt").eq("id", ticket.queueId).single();
  if (error || row.status !== "processing" || Date.parse(row.lease_expires_at) <= Date.now() || row.production_receipt?.request_id !== ticket.requestId || row.production_receipt?.state !== "publishing") throw new Error("Wiki publication request lost its exact live lease.");
  if (!urls) return;
  const { data, error: saveError } = await db.from("wiki_generation_queue").update({production_receipt: {...row.production_receipt, state: "published", urls, verified_at: new Date().toISOString()}}).eq("id",ticket.queueId).eq("status","processing").eq("lease_token",row.lease_token).eq("production_receipt->>request_id",ticket.requestId).eq("production_receipt->>state","publishing").select("id");
  if (saveError || data.length !== 1) throw new Error("The wiki receipt could not be acknowledged under its original lease.");
}
