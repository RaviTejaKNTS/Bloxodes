import { generateGrowGardenCollectionMetadata, renderGrowGardenCollectionRoute } from "../grow-a-garden/collection-route";

const COLLECTION = "crafting-recipes";

export const revalidate = 86400;

export async function generateMetadata() {
  return generateGrowGardenCollectionMetadata(COLLECTION);
}

export default async function GrowGardenCraftingRecipesPage() {
  return renderGrowGardenCollectionRoute(COLLECTION);
}
