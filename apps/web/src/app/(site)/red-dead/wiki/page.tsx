import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGameWikiByPath } from "@/lib/game-registry";
import { GameWikiHub } from "@/components/games/GameWikiHub";
import { gameWikiMetadata } from "@/components/games/GameWikiPage";
export const revalidate = 21600;
export async function generateMetadata(): Promise<Metadata> {
  const page = await getGameWikiByPath("red-dead", "/red-dead/wiki");
  return page ? gameWikiMetadata(page) : { robots: { index: false, follow: false } };
}
export default async function WikiIndex() {
  const page = await getGameWikiByPath("red-dead", "/red-dead/wiki");
  if (!page) notFound();
  return <GameWikiHub page={page} namespaceTitle="Red Dead" />;
}
