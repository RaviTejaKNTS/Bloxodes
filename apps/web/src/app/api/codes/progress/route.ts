import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session-user";
import {
  loadUserCodeProgress,
  normalizeCodeProgressSlug,
  normalizeCodeProgressValue,
  normalizeUsedCodes,
  saveUserCodeProgress,
  updateUserCodeProgress
} from "@/lib/code-progress";
import { isTrustedMutationOrigin } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const slug = normalizeCodeProgressSlug(new URL(request.url).searchParams.get("slug"));
    if (!slug) {
      return NextResponse.json({ error: "Game slug is required." }, { status: 400 });
    }

    const usedCodes = await loadUserCodeProgress(user.id, slug);
    return NextResponse.json(
      { usedCodes },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Failed to load code progress", error);
    return NextResponse.json({ error: "Unable to load code progress." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!isTrustedMutationOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => ({}));
    const slug = normalizeCodeProgressSlug(payload?.slug);
    const usedCodes = normalizeUsedCodes(payload?.usedCodes);

    if (!slug) {
      return NextResponse.json({ error: "Game slug is required." }, { status: 400 });
    }

    return NextResponse.json({
      usedCodes: await saveUserCodeProgress(user.id, slug, usedCodes)
    });
  } catch (error) {
    console.error("Failed to save code progress", error);
    return NextResponse.json({ error: "Unable to save code progress." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isTrustedMutationOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => ({}));
    const slug = normalizeCodeProgressSlug(payload?.slug);
    const code = normalizeCodeProgressValue(payload?.code);
    const used = typeof payload?.used === "boolean" ? payload.used : null;

    if (!slug || !code || used === null) {
      return NextResponse.json(
        { error: "Game slug, code, and used state are required." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      usedCodes: await updateUserCodeProgress({
        userId: user.id,
        gameSlug: slug,
        code,
        used
      })
    });
  } catch (error) {
    console.error("Failed to update code progress", error);
    return NextResponse.json({ error: "Unable to update code progress." }, { status: 500 });
  }
}
