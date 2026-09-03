import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session-user";
import { isTrustedMutationOrigin } from "@/lib/security/request";
import { supabaseAdmin } from "@/lib/supabase";
import {
  loadUserWikiCollectionProgress,
  loadUserWikiCollectionProgressIndex,
  normalizeWikiCollectionCode,
  normalizeWikiCollectionItemSlugs,
  saveUserWikiCollectionProgress
} from "@/lib/wiki-collection-progress";

export const dynamic = "force-dynamic";

function noStore<T>(payload: T, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { ...(init?.headers ?? {}), "Cache-Control": "private, no-store, max-age=0" }
  });
}

async function isPublishedChecklistCollection(code: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("wiki_collection_pages")
    .select("code")
    .eq("code", code)
    .eq("is_published", true)
    .eq("page_type", "checklist")
    .not("published_dataset_id", "is", null)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return noStore({ error: "Unauthorized" }, { status: 401 });

    const code = normalizeWikiCollectionCode(new URL(request.url).searchParams.get("code"));
    if (code) {
      if (!(await isPublishedChecklistCollection(code))) {
        return noStore({ error: "Unknown Roblox wiki checklist." }, { status: 404 });
      }
      return noStore({ checkedIds: await loadUserWikiCollectionProgress(user.id, code) });
    }

    return noStore({ progress: await loadUserWikiCollectionProgressIndex(user.id) });
  } catch (error) {
    console.error("Failed to load Roblox wiki collection progress", error);
    return noStore({ error: "Unable to load Roblox wiki collection progress." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!isTrustedMutationOrigin(request)) {
      return noStore({ error: "Invalid request origin." }, { status: 403 });
    }

    const user = await getSessionUser();
    if (!user) return noStore({ error: "Unauthorized" }, { status: 401 });

    const payload = await request.json().catch(() => ({}));
    const code = normalizeWikiCollectionCode(payload?.code);
    if (!code) return noStore({ error: "A Roblox wiki collection code is required." }, { status: 400 });
    if (!(await isPublishedChecklistCollection(code))) {
      return noStore({ error: "Unknown Roblox wiki checklist." }, { status: 404 });
    }

    const checkedIds = normalizeWikiCollectionItemSlugs(payload?.checkedIds);
    const saved = await saveUserWikiCollectionProgress(user.id, code, checkedIds);
    return noStore({ checkedIds: saved });
  } catch (error) {
    console.error("Failed to save Roblox wiki collection progress", error);
    return noStore({ error: "Unable to save Roblox wiki collection progress." }, { status: 500 });
  }
}
