import { load } from "cheerio";

const legacyFamilies = new Set(["articles", "authors", "catalog", "checklists", "codes", "events", "puzzles", "quizzes", "stats", "tools", "wiki"]);

export function publicationSitemap(pathname) {
  const [, family, section, subsection] = pathname.split("/");
  if (!family || family === "games") return "/sitemaps/main.xml";
  if (legacyFamilies.has(family)) return `/sitemaps/${section ? family : "main"}.xml`;
  if (family === "gta" && (!section || ["wiki", "maps", "checklists"].includes(section))) return "/sitemaps/gta.xml";
  if (family === "red-dead" && (!section || section === "wiki")) return "/sitemaps/red-dead.xml";
  if (family === "minecraft" && (!section || ["wiki", "tools"].includes(section) || ["java", "bedrock"].includes(section) && subsection === "wiki")) return "/sitemaps/minecraft.xml";
  return "/sitemaps/games.xml";
}

export async function verifyPublicText(pathname, expected, options = {}) {
  const request = options.request ?? fetch;
  const wait = options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const attempts = options.attempts ?? 6;
  let failure;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await request(`https://bloxodes.com${pathname}`, {
        cache: "no-store", headers: { "cache-control": "no-cache" }, signal: AbortSignal.timeout(10_000),
      });
      const body = load(await response.text())("body").text().replace(/\s+/g, " ").toLowerCase();
      if (!response.ok || !body.includes(expected.toLowerCase())) throw new Error(`Public readback failed for ${pathname}: HTTP ${response.status} or expected text missing.`);
      return;
    } catch (error) {
      failure = error;
      if (attempt < attempts) await wait(5_000);
    }
  }
  throw failure;
}
