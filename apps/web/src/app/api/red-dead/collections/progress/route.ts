import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session-user";
import { supabaseAdmin } from "@/lib/supabase";
import { isTrustedMutationOrigin } from "@/lib/security/request";
import {
  loadUserRedDeadCollectionProgress,
  loadUserRedDeadCollectionProgressIndex,
  normalizeRedDeadCollectionCode,
  normalizeRedDeadCollectionItemSlugs,
  saveUserRedDeadCollectionProgress
} from "@/lib/red-dead-collection-progress";

export const dynamic = "force-dynamic";

async function isPublishedChecklistCollection(code: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("red_dead_wiki_collection_pages")
    .select("code")
    .eq("code", code)
    .eq("is_published", true)
    .in("page_type", ["collectible", "checklist"])
    .not("published_dataset_id", "is", null)
    .maybeSingle();
  return !error && Boolean(data);
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function noStore<T>(payload: T, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { ...(init?.headers ?? {}), "Cache-Control": "private, no-store, max-age=0" }
  });
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const code = normalizeRedDeadCollectionCode(new URL(request.url).searchParams.get("code"));
    if (code) {
      if (!(await isPublishedChecklistCollection(code))) {
        return noStore({ error: "Unknown Red Dead checklist." }, { status: 404 });
      }
      const checkedIds = await loadUserRedDeadCollectionProgress(user.id, code);
      return noStore({ checkedIds });
    }

    const progress = await loadUserRedDeadCollectionProgressIndex(user.id);
    return noStore({ progress });
  } catch (error) {
    console.error("Failed to load Red Dead collection progress", error);
    return noStore({ error: "Unable to load Red Dead collection progress." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!isTrustedMutationOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const user = await getSessionUser();
    if (!user) return unauthorized();

    const payload = await request.json().catch(() => ({}));
    const code = normalizeRedDeadCollectionCode(payload?.code);
    if (!code) return noStore({ error: "A Red Dead collection code is required." }, { status: 400 });
    if (!(await isPublishedChecklistCollection(code))) {
      return noStore({ error: "Unknown Red Dead checklist." }, { status: 404 });
    }

    const checkedIds = normalizeRedDeadCollectionItemSlugs(payload?.checkedIds);
    const saved = await saveUserRedDeadCollectionProgress(user.id, code, checkedIds);
    return noStore({ checkedIds: saved });
  } catch (error) {
    console.error("Failed to save Red Dead collection progress", error);
    return noStore({ error: "Unable to save Red Dead collection progress." }, { status: 500 });
  }
}
