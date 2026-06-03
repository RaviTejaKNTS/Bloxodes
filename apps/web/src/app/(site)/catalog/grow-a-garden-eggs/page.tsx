import { generateGrowGardenCollectionMetadata, renderGrowGardenCollectionRoute } from "../grow-a-garden/collection-route";

const COLLECTION = "eggs";

export const revalidate = 21600;

export async function generateMetadata() {
  return generateGrowGardenCollectionMetadata(COLLECTION);
}

export default async function GrowGardenEggsPage() {
  return renderGrowGardenCollectionRoute(COLLECTION);
}
