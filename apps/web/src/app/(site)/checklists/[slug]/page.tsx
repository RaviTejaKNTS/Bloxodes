import { resolvePageTypeGameRoute } from "@/lib/page-type-game-route";
import { ROBLOX_CHECKLISTS } from "@/lib/engagement/config";
import { notFound } from "next/navigation";
import { getChecklistPageBySlug } from "@/lib/db";
import { ChecklistPageTemplate, checklistMetadata } from "@/components/ChecklistPageTemplate";
import { GameDiscoverySidebar } from "@/components/game-sidebar/GameDiscoverySidebar";

export const revalidate = 21600;
type PageProps = { params: Promise<{ slug: string }> };
export async function generateStaticParams() { return []; }
async function load(slug: string) {
  const data = await getChecklistPageBySlug(slug);
  return data ? { ...data, page: { ...data.page, image: data.page.universe?.icon_url } } : null;
}
export async function generateMetadata({ params }: PageProps) {
  const data = await load((await params).slug);
  if (!data) {
    const gameRoute = await resolvePageTypeGameRoute(`/checklists/${(await params).slug}`);
    if (gameRoute) return gameRoute.metadata();
  }
  return checklistMetadata(data, ROBLOX_CHECKLISTS);
}
export default async function ChecklistPage({ params }: PageProps) {
  const data = await load((await params).slug);
  if (!data) {
    const gameRoute = await resolvePageTypeGameRoute(`/checklists/${(await params).slug}`);
    if (gameRoute) return gameRoute.render();
    notFound();
  }
  const universe = data.page.universe;
  return (
    <ChecklistPageTemplate
      data={data}
      config={ROBLOX_CHECKLISTS}
      sidebar={
        <GameDiscoverySidebar
          universeId={data.page.universe_id ?? universe?.universe_id ?? null}
          universeName={universe?.display_name ?? universe?.name ?? null}
          currentType="checklist"
        />
      }
    />
  );
}
