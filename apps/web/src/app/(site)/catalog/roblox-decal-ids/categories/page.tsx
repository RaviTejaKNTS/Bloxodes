import type { Metadata } from "next";
import "@/styles/article-content.css";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import {
  buildDecalCategoriesPath,
  loadDecalCategories,
  renderRobloxDecalCategoriesPage
} from "../page-data";

export const revalidate = 21600;

const TITLE = "Roblox Decal ID Categories";
const SEO_TITLE = "Roblox Decal ID Categories [Image Codes]";
const DESCRIPTION =
  "Browse Roblox decal IDs by category, including anime, memes, aesthetic images, faces, logos, textures, and more.";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = `${SITE_URL.replace(/\/$/, "")}${buildDecalCategoriesPath()}`;
  return {
    title: `${SEO_TITLE} | ${SITE_NAME}`,
    description: DESCRIPTION,
    robots: { index: false, follow: true },
    alternates: buildAlternates(canonical),
    openGraph: {
      type: "website",
      url: canonical,
      title: SEO_TITLE,
      description: DESCRIPTION,
      siteName: SITE_NAME,
      images: [`${SITE_URL}/Bloxodes.png`]
    }
  };
}

export default async function RobloxDecalCategoriesPage() {
  const categories = await loadDecalCategories();

  return renderRobloxDecalCategoriesPage({ categories });
}
