import { mkdir, realpath } from "node:fs/promises";
import path from "node:path";

export async function resolveWikiAttemptRoot(queueRoot: string, savedRoot: string | null | undefined, attempt: number): Promise<string> {
  await mkdir(queueRoot, { recursive: true });
  const canonicalQueue = await realpath(queueRoot);
  // Existing attempts can refer to an older release or the original checkout.
  // Resolve the aliases before checking containment; never trust lexical prefixes.
  if (savedRoot) {
    const canonicalSaved = await realpath(savedRoot);
    const relative = path.relative(canonicalQueue, canonicalSaved);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error("Saved result root escapes queue workspace.");
    }
    return path.resolve(savedRoot);
  }
  const resultRoot = path.join(queueRoot, `attempt-${attempt}`);
  await mkdir(resultRoot, { recursive: true });
  return resolveWikiAttemptRoot(queueRoot, resultRoot, attempt);
}
