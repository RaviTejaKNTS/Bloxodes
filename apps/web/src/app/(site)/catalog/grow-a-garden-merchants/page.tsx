import { generateGrowGardenCollectionMetadata, renderGrowGardenCollectionRoute } from "../grow-a-garden/collection-route";

const COLLECTION = "merchants";

export const revalidate = 86400;

export async function generateMetadata() {
  return generateGrowGardenCollectionMetadata(COLLECTION);
}

export default async function GrowGardenMerchantsPage() {
  return renderGrowGardenCollectionRoute(COLLECTION);
}
