import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "./supabase";

export type LiveSiteRoute = {
  source: "game" | "roblox";
  page_type: "hub" | "wiki" | "collection" | "code" | "tool" | "map" | "quiz" | "catalog" | "checklist" | "event" | "article" | "puzzle";
  page_id: string;
  game_id: string | null;
};

// Request memoization only. Public HTML keeps the route's existing ISR policy.
// Redirect/prefix matching belongs to middleware, never the page renderer.
// null means no live row; undefined means the registry could not be read.
export const getLiveSiteRoute = cache(async (path: string): Promise<LiveSiteRoute | null | undefined> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("Site route read timed out"));
      }, 2000);
    });
    const { data, error } = await Promise.race([
      supabaseAdmin().from("site_routes")
        .select("source,page_type,page_id,game_id")
        .eq("path", path).eq("status", "live").eq("match_type", "exact")
        .abortSignal(controller.signal).maybeSingle(),
      deadline,
    ]);
    if (error) throw new Error("Site route read failed");
    return data as LiveSiteRoute | null;
  } catch {
    console.warn("Site route lookup unavailable; using by-path page readers.");
    return undefined;
  } finally {
    clearTimeout(timer);
  }
});
