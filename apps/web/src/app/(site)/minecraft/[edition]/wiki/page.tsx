import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseMinecraftEdition } from "@/lib/minecraft-edition";
import { minecraftWikiSlug } from "@/lib/minecraft-paths";
import { getMinecraftWikiPageBySlug } from "@/lib/minecraft";
import { gameWikiMetadata, renderGameWikiPage } from "@/components/games/GameWikiPage";
export const revalidate = 21600;
type Props = { params: Promise<{ edition: string }> };
async function load(params: Props["params"]) {
 const edition = parseMinecraftEdition((await params).edition);
 if (!edition) notFound();
 const page = await getMinecraftWikiPageBySlug(minecraftWikiSlug(edition));
 if (!page) notFound();
 return page;
}
export async function generateMetadata({params}: Props): Promise<Metadata> { return gameWikiMetadata(await load(params)); }
export default async function MinecraftWiki({params}: Props) { return renderGameWikiPage({ page: await load(params), namespace: "minecraft", namespaceTitle: "Minecraft" }); }
