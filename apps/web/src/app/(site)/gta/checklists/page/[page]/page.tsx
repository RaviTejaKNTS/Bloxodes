import { notFound, permanentRedirect } from "next/navigation";
import { buildAlternates } from "@/lib/seo";
import { GTA_CHECKLISTS_DESCRIPTION } from "@/lib/gta-checklists";
import { loadGtaChecklistsPage, renderGtaChecklistsPage } from "../../page-data";
export const revalidate = 21600;
type Props = { params: Promise<{ page: string }> };
export async function generateMetadata({ params }: Props) {
  const { page } = await params;
  return { title: `GTA Checklists - Page ${page}`, description: GTA_CHECKLISTS_DESCRIPTION,
    robots: { index: false, follow: true }, alternates: buildAlternates(`/gta/checklists/page/${page}`) };
}
export default async function GtaChecklistsPage({ params }: Props) {
  const raw = (await params).page;
  const page = Number(raw);
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(page)) notFound();
  if (page === 1) permanentRedirect("/gta/checklists");
  const data = await loadGtaChecklistsPage(page);
  if (page > data.totalPages) notFound();
  return renderGtaChecklistsPage({ ...data, currentPage: page });
}
