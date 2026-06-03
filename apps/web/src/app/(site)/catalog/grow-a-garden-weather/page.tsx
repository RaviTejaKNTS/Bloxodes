import { generateGrowGardenCollectionMetadata, renderGrowGardenCollectionRoute } from "../grow-a-garden/collection-route";

const COLLECTION = "weather";

export const revalidate = 21600;

export async function generateMetadata() {
  return generateGrowGardenCollectionMetadata(COLLECTION);
}

export default async function GrowGardenWeatherPage() {
  return renderGrowGardenCollectionRoute(COLLECTION);
}
