import type { SharedGameDatabase } from "../../../../supabase/types/shared-games";
import type { SupabaseClient } from "@supabase/supabase-js";

export const gameTables = {
  games: "games",
  wiki_pages: "game_wiki_pages",
  wiki_pages_view: "game_wiki_pages_view",
  wiki_collection_pages: "game_collection_pages",
  wiki_collection_pages_view: "game_collection_pages_view",
  wiki_collection_datasets: "game_collection_datasets",
  wiki_collection_items: "game_collection_items",
  checklist_pages: "game_checklist_pages",
  checklist_pages_view: "game_checklist_pages_view",
  checklist_items: "game_checklist_items",
  tools: "game_tool_pages",
  tools_view: "game_tool_pages_view",
  releases: "game_releases",
  collection_progress: "game_collection_progress"
} as const satisfies Record<string, keyof SharedGameDatabase["public"]["Tables"] | keyof SharedGameDatabase["public"]["Views"]>;

/** Existing callers keep their contracts while sharing storage and publication guards. */
export function gameDatabase(client: SupabaseClient, namespace: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(namespace)) throw new Error("Invalid game namespace");
  return {
    from(table: keyof typeof gameTables) {
      const query = client.from(gameTables[table]);
      return new Proxy(query, {
        get(target, property) {
          const method = Reflect.get(target, property);
          if (typeof method !== "function") return method;
          return (...args: unknown[]) => {
            if (property === "insert" || property === "upsert") {
              const payload = args[0];
              const attach = (row: Record<string, unknown>) => {
                if (row.namespace !== undefined && row.namespace !== namespace) throw new Error("Cross-game write rejected");
                return { ...row, namespace };
              };
              args[0] = Array.isArray(payload) ? payload.map(attach) : attach(payload as Record<string, unknown>);
              if (property === "upsert" && args[1]) {
                const options = args[1] as { onConflict?: string };
                if (options.onConflict && ["slug", "code", "edition,version", "user_id,collection_code"].includes(options.onConflict)) {
                  args[1] = { ...options, onConflict: table === "games" ? "namespace,slug,kind" : `namespace,${options.onConflict}` };
                }
              }
            }
            if (property === "update" && (args[0] as Record<string, unknown>)?.namespace !== undefined && (args[0] as Record<string, unknown>).namespace !== namespace) throw new Error("Cross-game write rejected");
            const result = Reflect.apply(method, target, args) as ReturnType<typeof query.select>;
            if (["select", "update", "delete"].includes(String(property))) {
              result.eq("namespace", namespace);
              if (table === "games") result.eq("kind", "game");
            }
            return result;
          };
        }
      });
    }
  };
}
