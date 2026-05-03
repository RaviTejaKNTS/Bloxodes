import { generateGrowGardenCollectionMetadata, renderGrowGardenCollectionRoute } from "../grow-a-garden/collection-route";

const COLLECTION = "seeds";

export const revalidate = 86400;

export async function generateMetadata() {
  return generateGrowGardenCollectionMetadata(COLLECTION);
}

export default async function GrowGardenSeedsPage() {
  return renderGrowGardenCollectionRoute(COLLECTION);
}
