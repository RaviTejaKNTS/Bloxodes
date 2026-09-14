import { GTA_CHECKLISTS } from "@/lib/engagement/config";
import { buildAlternates, SITE_NAME } from "@/lib/seo";
import { loadGtaChecklistsPage, renderGtaChecklistsPage } from "./page-data";
export const revalidate = 21600;
export const metadata = { title: `${GTA_CHECKLISTS.title} | ${SITE_NAME}`, description: GTA_CHECKLISTS.description, alternates: buildAlternates(GTA_CHECKLISTS.basePath) };
export default async function GtaChecklistsPage() {
  return renderGtaChecklistsPage({ ...await loadGtaChecklistsPage(1), currentPage: 1 });
}
