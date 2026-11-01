import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import captured from "./fixtures/moved-game-routes.json";
import { buildRedirectSnapshot, registryRequestRedirect, type RedirectRoute } from "../site-route-resolver";

// Managed-development route capture after #171. Owner IDs are placeholders.
const rows: RedirectRoute[] = captured.map(([path, target, page_type]) => ({ path, resolved_target: target, page_type, page_id: `owner:${target}`, status: "old", match_type: "exact", tail_mode: "append", match_self: true, target_url: null, redirect_code: 301, origin: "namespace-move" }));
const pagination: RedirectRoute = { path: "/gta/checklists/page", status: "old", match_type: "prefix", tail_mode: "drop", match_self: true, page_id: null, target_url: "/games/gta", resolved_target: "/games/gta", redirect_code: 301, origin: "namespace-cleanup" };
const snapshot = buildRedirectSnapshot([...rows, pagination]);
describe("retired game URL families", () => {
  it.each(rows)("$path reaches its live destination in one hop", row => {
    const result = registryRequestRedirect(snapshot, row.path, "");
    expect(result?.target).toBe(row.resolved_target);
    expect(result?.code).toBe(301);
    expect(registryRequestRedirect(snapshot, result!.target, "")).toBeNull();
    if (row.page_type === "collection") {
      expect(registryRequestRedirect(snapshot, row.path + "/page/2", "")?.target).toBe(row.resolved_target + "/page/2");
      expect(registryRequestRedirect(snapshot, row.resolved_target + "/page/2", "")).toBeNull();
    }
  });
  it.each([1, 2, 999])("covers deleted GTA directory pagination page %s", page => {
    expect(registryRequestRedirect(snapshot, `/gta/checklists/page/${page}`, "")?.target).toBe("/games/gta");
    const sql = readFileSync(new URL("../../../../../supabase/migrations/20261102200000_finish_moved_game_url_cleanup.sql", import.meta.url), "utf8");
    expect(sql).toContain("values('/gta/checklists/page','old','prefix',destination,'drop',301");
  });
  it("uses stored default owners in one hop and leaves static map assets alone", () => {
    expect(registryRequestRedirect(snapshot, "/minecraft/wiki/blocks", "")?.target).toBe("/wiki/minecraft-java/blocks");
    expect(registryRequestRedirect(snapshot, "/gta/maps/gta5/roadmap/0/0,1,1.jpg", "")).toBeNull();
  });
  it("contains no imports of deleted route folders", () => {
    const source = new URL("../../", import.meta.url).pathname;
    function scan(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? scan(resolve(dir, entry.name)) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [resolve(dir, entry.name)] : []);
    }
    for (const file of scan(source)) {
      const imports = readFileSync(file, "utf8").matchAll(/(?:from\s*|import\s*\(|vi\.mock\s*\()\s*["']([^"']+)["']/g);
      for (const [, name] of imports) expect(name, file).not.toMatch(/(?:app\/\(site\)\/(?:gta|red-dead|minecraft|\[slug\])(?:\/|$)|(?:^|\/)GameWikiHub$)/);
    }
  });
});
