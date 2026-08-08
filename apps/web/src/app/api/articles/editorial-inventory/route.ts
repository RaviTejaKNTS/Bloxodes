import { NextResponse } from "next/server";

import { EDITORIAL_INVENTORY_VERSION, loadEditorialInventory } from "@/lib/editorial-inventory";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-if-error=86400",
  "X-Content-Type-Options": "nosniff"
};

export async function GET() {
  try {
    const items = await loadEditorialInventory(supabaseAdmin());
    return NextResponse.json(
      {
        version: EDITORIAL_INVENTORY_VERSION,
        generated_at: new Date().toISOString(),
        items
      },
      { headers: RESPONSE_HEADERS }
    );
  } catch (error) {
    console.error("Failed to load editorial inventory", error);
    return NextResponse.json(
      { error: "Failed to load editorial inventory" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
