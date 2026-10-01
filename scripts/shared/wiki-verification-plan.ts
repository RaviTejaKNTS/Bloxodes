import { assertManagedDevelopmentSupabaseUrl } from "./supabase-target";

export function wikiVerificationSyncArgs(
  finalPath: string,
  expectedGame: string,
  final: { slug?: unknown; universe_id?: unknown },
  target: string | undefined
): string[] {
  assertManagedDevelopmentSupabaseUrl(target, "wiki final verification");
  if (typeof final.slug !== "string" || final.slug !== expectedGame || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(expectedGame)) {
    throw new Error(`Wiki final slug must exactly match ${expectedGame}.`);
  }
  if (!Number.isSafeInteger(final.universe_id) || Number(final.universe_id) <= 0) {
    throw new Error("Wiki final universe_id must be a positive safe integer.");
  }
  return ["run", "sync:game-wiki-runtime", "--", "--final-json", finalPath,
    "--game", expectedGame, "--universe-id", String(final.universe_id), "--apply"];
}
