import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { acquireAdvisoryFileLock } from "../shared/advisory-file-lock";
import type { NotionArticleQueue } from "./notion-article-queue";

const lockPath = fileURLToPath(new URL("../../tmp/article-queue/claims.lock", import.meta.url));

// Reuse the kernel flock helper already used by discovery on Linux and macOS.
export async function withArticleQueueClaimLock<T>(work: () => Promise<T>): Promise<T> {
  await mkdir(path.dirname(lockPath), { recursive: true });
  const deadline = Date.now() + 30_000;
  let unlock: (() => Promise<void>) | undefined;
  while (!unlock) {
    try { unlock = await acquireAdvisoryFileLock(lockPath); }
    catch (error) {
      if (!(error instanceof Error) || error.message !== "Article discovery state is busy.") throw error;
      if (Date.now() >= deadline) throw new Error("Queue claims are busy; try again.");
      await delay(100);
    }
  }
  try { return await work(); } finally { await unlock(); }
}

export const newArticleClaimToken = (worker: string) => `${worker}#${randomUUID()}`;

export function assertArticleClaimToken(row: { locked_by?: string | null; locked_at?: string | null }, token?: string) {
  if (!token || !row.locked_at || row.locked_by !== token) throw new Error("Claim ownership differs. Pass the exact --claim-token returned by the successful claim.");
}

export async function confirmArticleQueueClaim(queue: NotionArticleQueue, id: string, token: string, claimedAt: string, settle = () => delay(2_000)) {
  await settle();
  const row = await queue.get(id);
  assertArticleClaimToken(row, token);
  // Notion date properties have minute precision.
  if (row.status !== "processing" || row.locked_at!.slice(0, 16) !== claimedAt.slice(0, 16)) throw new Error("Claim was replaced during confirmation; do not start this article.");
  return row;
}
