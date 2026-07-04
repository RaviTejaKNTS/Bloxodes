import { NextResponse } from "next/server";
import { getMobileSessionUser } from "@/lib/auth/mobile-session";
import { mobileCredentialedFallbackHeaders, mobileCredentialedHeaders } from "@/lib/mobile-api-cors";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX_CHECKED_IDS = 2000;

const METHODS = "GET, PUT, OPTIONS";

function normalizeSlug(value: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return "";
  return trimmed;
}

function normalizeCheckedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= MAX_CHECKED_IDS) break;
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

    const admin = supabaseAdmin();
    const slug = normalizeSlug(new URL(request.url).searchParams.get("slug"));

    if (slug) {
      const { data, error } = await admin
        .from("user_checklist_progress")
        .select("checked_item_ids")
        .eq("user_id", user.id)
        .eq("checklist_slug", slug)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: "Unable to load checklist progress." }, { status: 500, headers });
      }

      const checkedIds = normalizeCheckedIds((data as { checked_item_ids?: unknown } | null)?.checked_item_ids);
      return NextResponse.json({ checkedIds }, { headers });
    }

    const { data, error } = await admin
      .from("user_checklist_progress")
      .select("checklist_slug, checked_item_ids")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Unable to load checklist progress." }, { status: 500, headers });
    }

    const progress = (data ?? [])
      .map((row) => {
        const checkedIds = normalizeCheckedIds((row as { checked_item_ids?: unknown } | null)?.checked_item_ids);
        return {
          slug: typeof row?.checklist_slug === "string" ? row.checklist_slug : "",
          checkedCount: checkedIds.length
        };
      })
      .filter((entry) => entry.slug);

    return NextResponse.json({ progress }, { headers });
  } catch (error) {
    console.error("Failed to load mobile checklist progress", error);
    return NextResponse.json(
      { error: "Unable to load checklist progress." },
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

    const admin = supabaseAdmin();
    const payload = await request.json().catch(() => ({}));
    const slug = normalizeSlug(typeof payload?.slug === "string" ? payload.slug : null);
    const checkedIds = normalizeCheckedIds(payload?.checkedIds);

    if (!slug) {
      return NextResponse.json({ error: "Checklist slug is required." }, { status: 400, headers });
    }

    if (checkedIds.length === 0) {
      const { error } = await admin
        .from("user_checklist_progress")
        .delete()
        .eq("user_id", user.id)
        .eq("checklist_slug", slug);

      if (error) {
        return NextResponse.json({ error: "Unable to clear checklist progress." }, { status: 500, headers });
      }

      return NextResponse.json({ checkedIds: [] }, { headers });
    }

    const { error } = await admin
      .from("user_checklist_progress")
      .upsert(
        {
          user_id: user.id,
          checklist_slug: slug,
          checked_item_ids: checkedIds
        },
        { onConflict: "user_id,checklist_slug" }
      );

    if (error) {
      return NextResponse.json({ error: "Unable to save checklist progress." }, { status: 500, headers });
    }

    return NextResponse.json({ checkedIds }, { headers });
  } catch (error) {
    console.error("Failed to save mobile checklist progress", error);
    return NextResponse.json(
      { error: "Unable to save checklist progress." },
      { status: 500, headers: mobileCredentialedFallbackHeaders(METHODS) }
    );
  }
}
