import { notFound } from "next/navigation";
import { getRedDeadWikiPageBySlug } from "@/lib/red-dead";
import { renderGameWikiPage, gameWikiMetadata } from "@/components/games/GameWikiPage";
export const revalidate = 21600;
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) { const page = await getRedDeadWikiPageBySlug((await params).slug); return page ? gameWikiMetadata(page) : { robots: { index: false } }; }
export default async function Page({ params }: Props) { const { slug } = await params; const page = await getRedDeadWikiPageBySlug(slug); if (!page) notFound(); const extraLinks: Array<{ href: string; title: string }> = []; return renderGameWikiPage({ page, namespace: "red-dead", namespaceTitle: "Red Dead", extraLinks }); }
