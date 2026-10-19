import { notFound } from "next/navigation";
import { getGameRoot, getGameWikiByPath } from "@/lib/game-registry";
import { gameRootWikiPage } from "@/lib/game-root-page";
import { gameWikiMetadata, renderGameWikiPage } from "@/components/games/GameWikiPage";

export const revalidate = 21600;
async function load() {
  const game = await getGameRoot("red-dead");
  if (!game) notFound();
  return gameRootWikiPage(game, await getGameWikiByPath("red-dead", "/red-dead/wiki"));
}
export async function generateMetadata() { return gameWikiMetadata(await load()); }
export default async function Page() {
  const page = await load();
  return renderGameWikiPage({ page, namespace: "red-dead", namespaceTitle: page.game_title });
}
