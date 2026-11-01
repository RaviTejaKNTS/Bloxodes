// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ read: vi.fn(async (_type: string, _id: string) => []) }));
vi.mock("@/lib/comments", () => ({ getApprovedComments: state.read }));
import { CommentsSection } from "../CommentsSection";

it.each(["game_wiki", "game_collection", "game_tool", "game_code", "game_map", "game_quiz", "game_catalog"] as const)("reads and posts the same stored %s identity", async entityType => {
  const section = await CommentsSection({ entityType, entityId: "page-id" });
  expect(state.read).toHaveBeenLastCalledWith(entityType, "page-id");
  const fetcher = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    if (url === "/api/comments/session") return new Response(JSON.stringify({ user: { id: "player", display_name: "Player" } }));
    expect(JSON.parse(String(options?.body))).toMatchObject({ entityType, entityId: "page-id", body: "A useful comment" });
    return new Response(JSON.stringify({ error: "test response" }), { status: 400 });
  });
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => { root.render(section); });
    const input = host.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "A useful comment");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(fetcher.mock.calls.some(([url]) => url === "/api/comments")).toBe(true);
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});

it("all retired comment producers use the identity written by the migration", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const migration = read("../../../../../../supabase/migrations/20261102210000_unify_game_discovery_and_comments.sql");
  expect(migration).toContain("when entity_type like '%_wiki_collection' then 'game_collection'");
  expect(migration).toContain("when entity_type like '%_tool' then 'game_tool'");
  expect(migration).toContain("else 'game_wiki'");
  for (const [file, type] of [["GameCollectionPage.tsx", "game_collection"], ["GameCollectibleCollectionPage.tsx", "game_collection"], ["GameWikiPage.tsx", "game_wiki"], ["specialized/minecraft/MinecraftTool.tsx", "game_tool"]]) {
    const source = read(`../../games/${file}`);
    expect(source).toContain(`"${type}"`);
    expect(source).not.toMatch(/"(?:gta_wiki|red_dead_wiki|minecraft_wiki|minecraft_tool)/);
  }
});
