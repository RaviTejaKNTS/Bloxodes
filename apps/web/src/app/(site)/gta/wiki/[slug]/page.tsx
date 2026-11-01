import { notFound } from "next/navigation";
import { getGtaWikiPageBySlug } from "@/lib/gta";
import { gameWikiMetadata } from "@/components/games/GameWikiPage";
import { renderGameWikiPage } from "@/components/games/GameWikiPage.server";
export const revalidate = 21600;
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) { const page = await getGtaWikiPageBySlug((await params).slug); return page ? gameWikiMetadata(page) : { robots: { index: false } }; }
export default async function Page({ params }: Props) {
  const page = await getGtaWikiPageBySlug((await params).slug);
  if (!page) notFound();
  return renderGameWikiPage({ page, namespace: "gta", namespaceTitle: "GTA" });
}
