import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSessionUser } from "@/lib/auth/session-user";
import { supabaseAdmin } from "@/lib/supabase";
import { moderateCommentBody } from "@/lib/comment-moderation";
import { getCommentsTag, toCommentEntry, type CommentRow } from "@/lib/comments";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp, isTrustedMutationOrigin } from "@/lib/security/request";
import { SITE_URL } from "@/lib/site-config";

export const dynamic = "force-dynamic";

const ALLOWED_ENTITY_TYPES = new Set([
  "code",
  "article",
  "catalog",
  "event",
  "tool",
  "wiki",
  "wiki_catalog"
]);
const MAX_BODY_LENGTH = 1000;
const MAX_GUEST_NAME_LENGTH = 60;
const MAX_GUEST_EMAIL_LENGTH = 120;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMENT_WRITE_RATE_LIMIT = {
  limit: 20,
  windowMs: 10 * 60 * 1000
};

type CommentEntityType = "code" | "article" | "catalog" | "event" | "tool" | "wiki" | "wiki_catalog";

type CommentPageTarget = {
  pageType: string;
  pageUrl: string;
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function isValidGuestEmail(value: string): boolean {
  if (!value) return false;
  if (value.length > MAX_GUEST_EMAIL_LENGTH) return false;
  if (!value.includes("@")) return false;
  const [local, domain] = value.split("@");
  if (!local || !domain) return false;
  if (!domain.includes(".")) return false;
  return true;
}

function buildPageUrl(path: string): string {
  return `${SITE_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function hasSlug(row: unknown): row is { slug: string } {
  return typeof row === "object" && row !== null && typeof (row as { slug?: unknown }).slug === "string";
}

function hasCode(row: unknown): row is { code: string } {
  return typeof row === "object" && row !== null && typeof (row as { code?: unknown }).code === "string";
}

function hasWikiCatalogPath(row: unknown): row is { wiki_slug: string; collection_slug: string } {
  return (
    typeof row === "object" &&
    row !== null &&
    typeof (row as { wiki_slug?: unknown }).wiki_slug === "string" &&
    typeof (row as { collection_slug?: unknown }).collection_slug === "string"
  );
}

async function resolveCommentPageTarget(entityType: CommentEntityType, entityId: string): Promise<CommentPageTarget | null> {
  const admin = supabaseAdmin();

  if (entityType === "code") {
    const { data, error } = await admin
      .from("code_pages")
      .select("slug")
      .eq("id", entityId)
      .eq("is_published", true)
      .maybeSingle();
    if (error || !hasSlug(data) || !data.slug.trim()) return null;
    return { pageType: "Code", pageUrl: buildPageUrl(`/codes/${data.slug}`) };
  }

  if (entityType === "article") {
    const { data, error } = await admin
      .from("articles")
      .select("slug")
      .eq("id", entityId)
      .eq("is_published", true)
      .maybeSingle();
    if (error || !hasSlug(data) || !data.slug.trim()) return null;
    return { pageType: "Article", pageUrl: buildPageUrl(`/articles/${data.slug}`) };
  }

  if (entityType === "catalog") {
    const { data, error } = await admin
      .from("catalog_pages")
      .select("code")
      .eq("id", entityId)
      .eq("is_published", true)
      .maybeSingle();
    if (error || !hasCode(data) || !data.code.trim()) return null;
    return { pageType: "Catalog", pageUrl: buildPageUrl(`/catalog/${data.code}`) };
  }

  if (entityType === "event") {
    const { data, error } = await admin
      .from("events_pages")
      .select("slug")
      .eq("id", entityId)
      .eq("is_published", true)
      .maybeSingle();
    if (error || !hasSlug(data) || !data.slug.trim()) return null;
    return { pageType: "Event", pageUrl: buildPageUrl(`/events/${data.slug}`) };
  }

  if (entityType === "tool") {
    const { data, error } = await admin
      .from("tools")
      .select("code")
      .eq("id", entityId)
      .eq("is_published", true)
      .maybeSingle();
    if (error || !hasCode(data) || !data.code.trim()) return null;
    return { pageType: "Tool", pageUrl: buildPageUrl(`/tools/${data.code}`) };
  }

  if (entityType === "wiki") {
    const { data, error } = await admin
      .from("wiki_pages")
      .select("slug")
      .eq("id", entityId)
      .eq("is_published", true)
      .maybeSingle();
    if (error || !hasSlug(data) || !data.slug.trim()) return null;
    return { pageType: "Wiki", pageUrl: buildPageUrl(`/wiki/${data.slug}`) };
  }

  const { data, error } = await admin
    .from("wiki_catalog_pages")
    .select("wiki_slug, collection_slug")
    .eq("id", entityId)
    .eq("is_published", true)
    .maybeSingle();
  if (error || !hasWikiCatalogPath(data) || !data.wiki_slug.trim() || !data.collection_slug.trim()) return null;
  return {
    pageType: "Wiki Catalog",
    pageUrl: buildPageUrl(`/wiki/${data.wiki_slug}/${data.collection_slug}`)
  };
}

export async function POST(request: Request) {
  try {
    if (!isTrustedMutationOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const ip = getRequestIp(request);
    const rateLimit = checkRateLimit({
      key: `comments:create:${ip}`,
      ...COMMENT_WRITE_RATE_LIMIT
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many comment attempts. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) }
        }
      );
    }

    const payload = await request.json();
    const entityType = normalizeString(payload?.entityType) as CommentEntityType;
    const entityId = normalizeString(payload?.entityId);
    const parentId = normalizeString(payload?.parentId || "");
    const body = normalizeString(payload?.body);
    const guestName = normalizeString(payload?.guestName);
    const guestEmail = normalizeEmail(payload?.guestEmail);

    if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
      return NextResponse.json({ error: "Invalid comment target." }, { status: 400 });
    }

    if (!UUID_REGEX.test(entityId)) {
      return NextResponse.json({ error: "Invalid comment target." }, { status: 400 });
    }

    if (!body) {
      return NextResponse.json({ error: "Comment cannot be empty." }, { status: 400 });
    }

    if (body.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: `Comments must be ${MAX_BODY_LENGTH} characters or less.` }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      if (!guestName || guestName.length < 2 || guestName.length > MAX_GUEST_NAME_LENGTH) {
        return NextResponse.json({ error: "Please enter a valid name to comment." }, { status: 400 });
      }
      if (!isValidGuestEmail(guestEmail)) {
        return NextResponse.json({ error: "Please enter a valid email address to comment." }, { status: 400 });
      }
    }

    const admin = supabaseAdmin();
    const pageTarget = await resolveCommentPageTarget(entityType, entityId);
    if (!pageTarget) {
      return NextResponse.json({ error: "Invalid comment target." }, { status: 400 });
    }

    if (parentId) {
      const { data: parentRow } = await admin
        .from("comments")
        .select("id, entity_type, entity_id")
        .eq("id", parentId)
        .maybeSingle();
      if (!parentRow || parentRow.entity_type !== entityType || parentRow.entity_id !== entityId) {
        return NextResponse.json({ error: "Invalid reply target." }, { status: 400 });
      }
    }

    const moderationDecision = await moderateCommentBody(body);
    if (!moderationDecision.approved) {
      return NextResponse.json({ error: "Comment did not pass moderation." }, { status: 400 });
    }

    const { data: inserted, error: insertError } = await admin
      .from("comments")
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        parent_id: parentId || null,
        author_id: sessionUser?.id ?? null,
        guest_name: sessionUser ? null : guestName,
        guest_email: sessionUser ? null : guestEmail,
        page_type: pageTarget.pageType,
        page_url: pageTarget.pageUrl,
        body_md: body,
        status: "approved",
        moderation: moderationDecision.moderation
      })
      .select("id")
      .maybeSingle();

    if (insertError || !inserted?.id) {
      console.error("Failed to insert comment", insertError);
      return NextResponse.json({ error: "Unable to submit comment." }, { status: 500 });
    }

    const { data: commentRow, error: commentError } = await admin
      .from("comments")
      .select(
        "id, parent_id, body_md, status, created_at, author_id, guest_name, author:app_users(display_name, roblox_avatar_url, roblox_display_name, roblox_username, role)"
      )
      .eq("id", inserted.id)
      .maybeSingle();

    if (commentError || !commentRow) {
      console.error("Failed to load comment", commentError);
      return NextResponse.json({ error: "Unable to load comment." }, { status: 500 });
    }

    const normalizedRow = {
      ...commentRow,
      author: Array.isArray(commentRow.author) ? (commentRow.author[0] ?? null) : (commentRow.author ?? null)
    } as unknown as CommentRow;

    const comment = await toCommentEntry(normalizedRow);

    revalidateTag(getCommentsTag(entityType, entityId), { expire: 0 });

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("Unhandled comment error", error);
    return NextResponse.json({ error: "Unable to submit comment." }, { status: 500 });
  }
}
