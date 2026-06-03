import { generateGrowGardenCollectionMetadata, renderGrowGardenCollectionRoute } from "../grow-a-garden/collection-route";

const COLLECTION = "crops";

export const revalidate = 21600;

export async function generateMetadata() {
  return generateGrowGardenCollectionMetadata(COLLECTION);
}

export default async function GrowGardenCropsPage() {
  return renderGrowGardenCollectionRoute(COLLECTION);
}
