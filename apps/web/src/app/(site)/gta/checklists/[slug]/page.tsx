import { GTA_CHECKLISTS } from "@/lib/engagement/config";
import { notFound } from "next/navigation";
import { getGtaChecklistPageBySlug, listPublishedGtaChecklists } from "@/lib/gta-checklists";
import { ChecklistPageTemplate, checklistMetadata } from "@/components/ChecklistPageTemplate";
import { ChecklistRelatedList } from "@/components/checklists/ChecklistRelatedList";
export const revalidate = 21600;
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  return checklistMetadata(await getGtaChecklistPageBySlug((await params).slug), GTA_CHECKLISTS);
}
export default async function GtaChecklistPage({ params }: Props) {
  const data = await getGtaChecklistPageBySlug((await params).slug);
  if (!data) notFound();
  const { checklists } = await listPublishedGtaChecklists(1, 7);
  const related = checklists
    .filter((row) => row.slug !== data.page.slug)
    .slice(0, 6)
    .map((row) => ({ href: `${GTA_CHECKLISTS.basePath}/${row.slug}`, title: row.title, image: row.image ?? null, itemsCount: row.leaf_item_count }));
  return (
    <ChecklistPageTemplate
      data={data}
      config={GTA_CHECKLISTS}
      sidebar={<ChecklistRelatedList heading="More GTA checklists" links={related} />}
    />
  );
}
