import { notFound } from "next/navigation";
import { getGtaWikiPageBySlug } from "@/lib/gta";
import { renderGameWikiPage, gameWikiMetadata } from "@/components/games/GameWikiPage";
import { getGtaChecklistPageBySlug } from "@/lib/gta-checklists";
import { getGtaMapRouteForWikiSlug } from "@/lib/gta-interactive-map-registry";
export const revalidate = 21600;
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) { const page = await getGtaWikiPageBySlug((await params).slug); return page ? gameWikiMetadata(page) : { robots: { index: false } }; }
export default async function Page({ params }: Props) { const { slug } = await params; const page = await getGtaWikiPageBySlug(slug); if (!page) notFound(); const checklist = await getGtaChecklistPageBySlug(slug); const map = getGtaMapRouteForWikiSlug(slug); const extraLinks = [...(map ? [{ href: map, title: "Explore the interactive map" }] : []), ...(checklist ? [{ href: `/gta/checklists/${slug}`, title: `Track your 100% completion with the ${page.game_title} checklist` }] : [])]; return renderGameWikiPage({ page, namespace: "gta", namespaceTitle: "GTA", extraLinks }); }
