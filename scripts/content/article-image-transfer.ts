import { isTransientHttpStatus } from "../shared/transient-http";
import type { ArticleImageEntry } from "./article-image-readiness";

type UploadError = { message: string; status?: number; statusCode?: string | number };
export async function uploadArticleImageWithRetries(
  upload: () => Promise<{ error: UploadError | null }>,
  pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
) {
  for (let attempt = 0; ; attempt++) {
    let error: UploadError;
    try { const result = await upload(); if (!result.error) return; error = result.error; }
    catch (caught) { error = { message: caught instanceof Error ? caught.message : String(caught) }; }
    const status = Number(error.statusCode ?? error.status);
    const transient = status ? isTransientHttpStatus(status) : /fetch failed|network|timeout|timed out|econn|enotfound|socket|connection|aborted/i.test(error.message);
    if (!transient || attempt >= 2) throw new Error(`upload failed after ${attempt + 1} attempt(s): ${error.message}`);
    await pause(1000 * 2 ** attempt);
  }
}

export function markArticleImageUnavailable(entry: ArticleImageEntry, kind: "transfer" | "inspection", error: unknown) {
  entry.status = "missing";
  entry.missing_reason = `Optional image ${kind} failed: ${error instanceof Error ? error.message : String(error)}`;
  entry.availability_failure = kind;
  entry.acceptance_note = "Code omitted this unavailable optional image; article writing can proceed without it.";
  entry.public_url = null;
  entry.uploaded_path = null;
  entry.width = null;
  entry.height = null;
}
