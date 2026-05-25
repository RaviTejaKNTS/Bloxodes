import { generateForgeCollectionMetadata, renderForgeCollectionRoute } from "../the-forge/collection-route";

const COLLECTION = "locations";

export const revalidate = 0;

export async function generateMetadata() {
  return generateForgeCollectionMetadata(COLLECTION);
}

export default async function TheForgeLocationsPage() {
  return renderForgeCollectionRoute(COLLECTION);
}
