import "server-only";
import { cache } from "react";
import { getLiveSiteRoute } from "./site-route-page";
import { supabaseAdmin } from "./supabase";
import GameRoutePage, { generateMetadata } from "@/components/games/GameRoutePage";

/** One memoized live registry read; called only after the Roblox reader misses. */
export const resolvePageTypeGameRoute = cache(async (path: string) => {
  try {
    const basePath = path.replace(/\/page\/[1-9]\d*$/, "");
    const route = await getLiveSiteRoute(basePath);
    if (route === null || route?.source === "roblox") return null;
    let namespace: string | undefined;
    if (route) {
      const { data, error } = await supabaseAdmin().from("games").select("namespace,url_style").eq("id", route.game_id).maybeSingle();
      if (error) throw new Error("Game route identity unavailable");
      if (data?.url_style !== "page_type") return null;
      namespace = data.namespace;
    } else {
      // Phase 4 outage fallback. Exact stored paths only; never guess a namespace
      // from a globally shared slug, and never query all eight page families.
      const section = basePath.split("/")[1];
      const kind = ({games:"wiki",wiki:basePath.split("/").length>3?"collection":"wiki",codes:"code",tools:"tool",maps:"map",quizzes:"quiz",checklists:"checklist",catalog:"catalog"} as Record<string,string>)[section];
      if (!kind) return null;
      const { data, error } = await supabaseAdmin().from(`game_${kind}_pages_view`).select("namespace").eq("canonical_path", basePath).maybeSingle();
      if (error) throw new Error("Game route fallback unavailable");
      namespace = data?.namespace;
    }
    if (!namespace) return null;
    const props = { params: Promise.resolve({ slug: namespace, sitePath: path }) };
    return { render: () => GameRoutePage(props), metadata: () => generateMetadata(props) };
  } catch {
    console.error("[game-routes] Game route lookup failed.");
    return null;
  }
});
