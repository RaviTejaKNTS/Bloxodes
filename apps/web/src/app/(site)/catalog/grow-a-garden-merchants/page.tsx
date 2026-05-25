import { generateGrowGardenCollectionMetadata, renderGrowGardenCollectionRoute } from "../grow-a-garden/collection-route";

const COLLECTION = "merchants";

export const revalidate = 0;

export async function generateMetadata() {
  return generateGrowGardenCollectionMetadata(COLLECTION);
}

export default async function GrowGardenMerchantsPage() {
  return renderGrowGardenCollectionRoute(COLLECTION);
}
