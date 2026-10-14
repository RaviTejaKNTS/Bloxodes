import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGameWikiByPath } from "@/lib/game-registry";
import { GameWikiHub } from "@/components/games/GameWikiHub";
import { gameWikiMetadata } from "@/components/games/GameWikiPage";
import { HubsSidebarLayout, hubsSidebarLinksFor } from "@/components/hubs/HubsSidebar";
export const revalidate = 21600;
export async function generateMetadata(): Promise<Metadata> {
  const page = await getGameWikiByPath("minecraft", "/minecraft/wiki");
  return page ? gameWikiMetadata(page) : { robots: { index: false, follow: false } };
}
export default async function WikiIndex() {
  const page = await getGameWikiByPath("minecraft", "/minecraft/wiki");
  if (!page) notFound();
  const { heading, links } = hubsSidebarLinksFor("minecraft");
  return <HubsSidebarLayout canonicalPath={page.canonical_path} title={page.title} heading={heading} links={links}><GameWikiHub page={page} namespaceTitle="Minecraft" /></HubsSidebarLayout>;
}
