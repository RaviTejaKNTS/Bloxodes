import { ROBLOX_CHECKLISTS } from "@/lib/engagement/config";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import { loadChecklistsPageData, renderChecklistsPage } from "./page-data";

export const revalidate = 21600;

export const metadata = {
  title: `${ROBLOX_CHECKLISTS.title} | ${SITE_NAME}`,
  description: ROBLOX_CHECKLISTS.description,
  alternates: buildAlternates(`${SITE_URL}${ROBLOX_CHECKLISTS.basePath}`)
};

export default async function ChecklistsPage() {
  const { cards, total, totalPages } = await loadChecklistsPageData(1);
  if (!cards) {
    notFound();
  }

  return renderChecklistsPage({
    cards,
    total,
    totalPages,
    currentPage: 1,
    showHero: true
  });
}
