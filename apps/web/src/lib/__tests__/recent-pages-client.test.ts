// @vitest-environment jsdom
import { expect, it } from "vitest";
import { recentPageKind } from "../recent-pages-client";

it.each(["gta-5", "minecraft-java", "terraria", "peak", "future-game"])("tracks every %s page through shared routes", slug => {
 for (const [family, kind] of [["wiki", "wiki"], ["maps", "map"], ["codes", "codes"], ["tools", "tool"], ["checklists", "checklist"], ["quizzes", "quiz"], ["catalog", "catalog"]]) {
  expect(recentPageKind(`/${family}/${slug}`)).toBe(kind);
 }
 expect(recentPageKind(`/wiki/${slug}/items`)).toBe("wiki");
});
it.each(["/", "/maps", "/wiki", "/tools", "/games/terraria"])("does not record the index %s", path => {
 expect(recentPageKind(path)).toBeNull();
});
