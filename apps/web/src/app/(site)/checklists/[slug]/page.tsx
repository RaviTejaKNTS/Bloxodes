import { ROBLOX_CHECKLISTS } from "@/lib/engagement/config";
import { notFound } from "next/navigation";
import { getChecklistPageBySlug } from "@/lib/db";
import { ChecklistPageTemplate, checklistMetadata } from "@/components/ChecklistPageTemplate";

export const revalidate = 21600;
type PageProps = { params: Promise<{ slug: string }> };
export async function generateStaticParams() { return []; }
async function load(slug: string) {
  const data = await getChecklistPageBySlug(slug);
  return data ? { ...data, page: { ...data.page, image: data.page.universe?.icon_url } } : null;
}
export async function generateMetadata({ params }: PageProps) {
  return checklistMetadata(await load((await params).slug), ROBLOX_CHECKLISTS);
}
export default async function ChecklistPage({ params }: PageProps) {
  const data = await load((await params).slug);
  if (!data) notFound();
  return <ChecklistPageTemplate data={data} config={ROBLOX_CHECKLISTS} />;
}
