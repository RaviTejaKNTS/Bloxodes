export const ARTICLE_QUEUE_STATUSES = [
  "pending",
  "processing",
  "blocked",
  "completed",
  "published",
  "rejected",
  "skipped",
  "failed"
] as const;

export type ArticleQueueStatus = (typeof ARTICLE_QUEUE_STATUSES)[number];

export const ARTICLE_TOPIC_DEDUPE_STATUSES: ArticleQueueStatus[] = [
  "pending",
  "processing",
  "blocked",
  "completed",
  "published",
  "rejected"
];

const ALLOWED_TRANSITIONS: Record<ArticleQueueStatus, ArticleQueueStatus[]> = {
  pending: ["processing", "skipped", "failed"],
  processing: ["processing", "blocked", "completed", "skipped", "failed"],
  blocked: ["pending", "blocked", "skipped", "failed"],
  completed: ["completed", "published", "rejected"],
  published: ["published"],
  rejected: ["rejected"],
  skipped: ["skipped"],
  failed: ["failed"]
};

export function parseArticleQueueStatus(value: string | undefined): ArticleQueueStatus {
  if (!value || !ARTICLE_QUEUE_STATUSES.includes(value as ArticleQueueStatus)) {
    throw new Error(`Unsupported queue status: ${value ?? "(missing)"}`);
  }
  return value as ArticleQueueStatus;
}

export function assertArticleQueueTransition(current: string, target: ArticleQueueStatus): void {
  const currentStatus = parseArticleQueueStatus(current);
  if (!ALLOWED_TRANSITIONS[currentStatus].includes(target)) {
    throw new Error(`Cannot move ${currentStatus} queue item to ${target}.`);
  }
}
