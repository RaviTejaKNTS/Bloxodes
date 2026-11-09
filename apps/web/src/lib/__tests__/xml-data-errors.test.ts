import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => { throw new Error("database unavailable"); } }));

const routes = import.meta.glob<{ GET: () => Promise<Response> }>([
  "../../app/sitemaps/{articles,authors,catalog,checklists,codes,events,games,moved,puzzles,quizzes,stats,tools,wiki}.xml/route.ts",
  "../../app/feed.xml/route.ts"
]);

it.each(Object.entries(routes).map(([path, load]) => ({ path, load })))("$path returns an uncacheable 503 on a read failure", async ({ load }) => {
  const response = await (await load()).GET();
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.text()).not.toContain("<urlset");
});
