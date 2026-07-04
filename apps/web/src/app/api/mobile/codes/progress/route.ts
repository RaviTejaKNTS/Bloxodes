import { NextResponse } from "next/server";
import { getMobileSessionUser } from "@/lib/auth/mobile-session";
import { mobileCredentialedFallbackHeaders, mobileCredentialedHeaders } from "@/lib/mobile-api-cors";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX_USED_CODES = 1000;
const METHODS = "GET, PUT, OPTIONS";

function normalizeSlug(value: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return "";
  return trimmed;
}

function normalizeUsedCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const result: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= MAX_USED_CODES) break;
  }

  return result;
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: mobileCredentialedHeaders(request, METHODS)
  });
}

export async function GET(request: Request) {
  const headers = mobileCredentialedHeaders(request, METHODS);
  try {
    const user = await getMobileSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    const slug = normalizeSlug(new URL(request.url).searchParams.get("slug"));
    if (!slug) {
      return NextResponse.json({ error: "Game slug is required." }, { status: 400, headers });
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("user_code_progress")
      .select("used_code_ids")
      .eq("user_id", user.id)
      .eq("game_slug", slug)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Unable to load code progress." }, { status: 500, headers });
    }

    return NextResponse.json(
      {
        usedCodes: normalizeUsedCodes((data as { used_code_ids?: unknown } | null)?.used_code_ids)
      },
      { headers }
    );
  } catch (error) {
    console.error("Failed to load mobile code progress", error);
    return NextResponse.json(
      { error: "Unable to load code progress." },
      { status: 500, headers: mobileCredentialedFallbackHeaders(METHODS) }
    );
  }
}

export async function PUT(request: Request) {
  const headers = mobileCredentialedHeaders(request, METHODS);
  try {
    const user = await getMobileSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    const payload = await request.json().catch(() => ({}));
    const slug = normalizeSlug(typeof payload?.slug === "string" ? payload.slug : null);
    const usedCodes = normalizeUsedCodes(payload?.usedCodes);

    if (!slug) {
      return NextResponse.json({ error: "Game slug is required." }, { status: 400, headers });
    }

    const admin = supabaseAdmin();

    if (usedCodes.length === 0) {
      const { error } = await admin
        .from("user_code_progress")
        .delete()
        .eq("user_id", user.id)
        .eq("game_slug", slug);

      if (error) {
        return NextResponse.json({ error: "Unable to clear code progress." }, { status: 500, headers });
      }

      return NextResponse.json({ usedCodes: [] }, { headers });
    }

    const { error } = await admin
      .from("user_code_progress")
      .upsert(
        {
          user_id: user.id,
          game_slug: slug,
          used_code_ids: usedCodes
        },
        { onConflict: "user_id,game_slug" }
      );

    if (error) {
      return NextResponse.json({ error: "Unable to save code progress." }, { status: 500, headers });
    }

    return NextResponse.json({ usedCodes }, { headers });
  } catch (error) {
    console.error("Failed to save mobile code progress", error);
    return NextResponse.json(
      { error: "Unable to save code progress." },
      { status: 500, headers: mobileCredentialedFallbackHeaders(METHODS) }
    );
  }
}
