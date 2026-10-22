import { notFound } from "next/navigation";
import { getGameLanding } from "@/lib/game-landing";
import { gameRootWikiPage } from "@/lib/game-root-page";
import { gameWikiMetadata } from "@/components/games/GameWikiPage";
import { renderGameWikiPage } from "@/components/games/GameWikiPage.server";

export const revalidate = 21600;
async function load() {
  const { root: game, wiki, hasIndependentRoot } = await getGameLanding("gta");
  if (!game) notFound();
  return gameRootWikiPage(game, wiki, hasIndependentRoot);
}
export async function generateMetadata() { return gameWikiMetadata(await load()); }
export default async function Page() {
  const page = await load();
  return renderGameWikiPage({ page, namespace: "gta", namespaceTitle: page.game_title });
}
