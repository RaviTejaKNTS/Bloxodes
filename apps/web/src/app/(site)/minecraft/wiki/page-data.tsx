import { ContentCard } from "@/components/ContentCard";
import { listPublishedMinecraftWikiPages, resolveMinecraftWikiCoverImage } from "@/lib/minecraft";
export async function MinecraftEditionCards() {
  const pages = await listPublishedMinecraftWikiPages();
  return <>{pages.map(page => <div key={page.id} data-journey-item><ContentCard type="wiki" href={page.canonical_path} title={page.title} subtitle={page.meta_description ?? undefined} image={{ src: resolveMinecraftWikiCoverImage(page), alt: page.title }} /></div>)}</>;
}
