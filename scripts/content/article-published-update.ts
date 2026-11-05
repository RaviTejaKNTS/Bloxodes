import type { ArticleFinal } from "../../contracts/article/v1/schema";

// A snapshot is supplied only by the direct publisher for an existing published row.
export type PublishedArticleIdentity = {
  id: string;
  slug: string;
  author_id: string;
  published_at: string;
  cover_image: string;
  is_published: boolean;
};

export function publishedArticleAction(mismatch: string | null, updatePublished = false): "verify" | "update" {
  if (!mismatch) return "verify";
  if (!updatePublished) throw new Error(`The live article differs from this bundle (${mismatch}). Use --update-published to apply the change.`);
  return "update";
}

// undefined mismatch means comparison was skipped (dry run without a media bucket).
// Acknowledgement is allowed only after the chosen path finishes verification.
export function productionArticleDecision({ live, mismatch, queueStatus, updatePublished, explicitCover }: {
  live: { is_published?: unknown } | null;
  mismatch: string | null | undefined;
  queueStatus: string;
  updatePublished: boolean;
  explicitCover: boolean;
}): { action: "new" | "refuse" | "verify" | "update" | "retry" | "skip"; acknowledgeQueue: boolean } {
  if (mismatch === undefined) return { action: "skip", acknowledgeQueue: false };
  const acknowledgeQueue = queueStatus === "completed";
  if (!live?.is_published) return { action: "new", acknowledgeQueue };
  if (mismatch && !updatePublished) return { action: "refuse", acknowledgeQueue: false };
  if (mismatch || (updatePublished && explicitCover)) return { action: "update", acknowledgeQueue };
  if (queueStatus === "completed") return { action: "retry", acknowledgeQueue: true };
  return { action: "verify", acknowledgeQueue: false };
}

export function publishedArticlePayload<T extends { slug: string; author_id: string; published_at: string | null; is_published: boolean; cover_image: string | null }>(
  payload: T, existing: PublishedArticleIdentity, final: Pick<ArticleFinal, "cover_image">,
): T {
  if (existing.slug !== payload.slug || !existing.id || !existing.author_id || !existing.published_at || !existing.cover_image || !existing.is_published) {
    throw new Error("Published article update requires the same existing published article with its author, date and cover.");
  }
  return { ...payload, author_id: existing.author_id, published_at: existing.published_at, is_published: true,
    cover_image: final.cover_image ? payload.cover_image : existing.cover_image };
}
