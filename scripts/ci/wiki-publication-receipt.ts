import { createClient } from "@supabase/supabase-js";
import { wikiReceiptMatches } from "./wiki-publication-state.mjs";

export async function wikiPublicationReceipt(ticket: any, urls?: string[]) {
  if (!ticket) return;
  if (!/^[0-9a-f-]{36}$/i.test(ticket.queueId ?? "") || typeof ticket.requestId !== "string" || !ticket.requestId.startsWith(`${ticket.queueId}-`)) throw new Error("Invalid exact wiki publication ticket.");
  if (process.env.ARTICLE_DEV_SUPABASE_URL !== "https://bbtcaurrtyoukvjbxbbj.supabase.co") throw new Error("Unexpected queue project.");
  const db = createClient(process.env.ARTICLE_DEV_SUPABASE_URL, process.env.ARTICLE_DEV_SUPABASE_SERVICE_ROLE!, { auth: { persistSession: false } });
  const { data: row, error } = await db.from("wiki_generation_queue").select("status,lease_token,lease_expires_at,production_receipt").eq("id", ticket.queueId).single();
  const durable = row?.status === "publishing";
  if (error || !wikiReceiptMatches(row,ticket)) throw new Error("Wiki publication request lost its exact request or live legacy lease.");
  if (!urls) return;
  const now = new Date().toISOString();
  let save = db.from("wiki_generation_queue").update({production_receipt: {...row.production_receipt, state: "published", urls, verified_at: now}, ...(durable ? {status: "published", published_at: now, completed_at: now, last_error: null} : {})}).eq("id",ticket.queueId).eq("status",row.status).eq("production_receipt->>request_id",ticket.requestId).eq("production_receipt->>state","publishing");
  if (!durable) save = save.eq("lease_token",row.lease_token).gt("lease_expires_at",now);
  const { data, error: saveError } = await save.select("id");
  if (saveError || data?.length !== 1) throw new Error("The wiki receipt could not be acknowledged under its exact request.");
}

export async function wikiPublicationFailure(ticket: any) {
  if (!ticket || process.env.ARTICLE_DEV_SUPABASE_URL !== "https://bbtcaurrtyoukvjbxbbj.supabase.co") return;
  const db = createClient(process.env.ARTICLE_DEV_SUPABASE_URL, process.env.ARTICLE_DEV_SUPABASE_SERVICE_ROLE!, {auth: {persistSession: false}});
  const {data: row, error} = await db.from("wiki_generation_queue").select("production_receipt").eq("id",ticket.queueId).eq("status","publishing").eq("production_receipt->>request_id",ticket.requestId).eq("production_receipt->>state","publishing").maybeSingle();
  if (error) throw error;
  if (!row) return;
  const saved = await db.from("wiki_generation_queue").update({production_receipt: {...row.production_receipt,state: "failed",error: "GitHub publication failed. Inspect its run before retrying.",failed_at: new Date().toISOString()}}).eq("id",ticket.queueId).eq("status","publishing").eq("production_receipt->>request_id",ticket.requestId).eq("production_receipt->>state","publishing");
  if (saved.error) throw saved.error;
}
