import { GTA_CHECKLISTS } from "@/lib/engagement/config";
import { notFound } from "next/navigation";
import { getGtaChecklistPageBySlug } from "@/lib/gta-checklists";
import { ChecklistPageTemplate, checklistMetadata } from "@/components/ChecklistPageTemplate";
export const revalidate = 21600;
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  return checklistMetadata(await getGtaChecklistPageBySlug((await params).slug), GTA_CHECKLISTS);
}
export default async function GtaChecklistPage({ params }: Props) {
  const data = await getGtaChecklistPageBySlug((await params).slug);
  if (!data) notFound();
  return <ChecklistPageTemplate data={data} config={GTA_CHECKLISTS} />;
}
