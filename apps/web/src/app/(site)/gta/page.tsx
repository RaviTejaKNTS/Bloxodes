import { notFound } from "next/navigation";
import { getGameRoot, getGameWikiByPath } from "@/lib/game-registry";
import { gameRootWikiPage } from "@/lib/game-root-page";
import { gameWikiMetadata } from "@/components/games/GameWikiPage";
import { renderGameWikiPage } from "@/components/games/GameWikiPage.server";

export const revalidate = 21600;
async function load() {
  const game = await getGameRoot("gta");
  if (!game) notFound();
  return gameRootWikiPage(game, await getGameWikiByPath("gta", "/gta/wiki"));
}
export async function generateMetadata() { return gameWikiMetadata(await load()); }
export default async function Page() {
  const page = await load();
  return renderGameWikiPage({ page, namespace: "gta", namespaceTitle: page.game_title });
}
