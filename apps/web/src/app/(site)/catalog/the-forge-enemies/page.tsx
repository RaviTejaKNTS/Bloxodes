import { generateForgeCollectionMetadata, renderForgeCollectionRoute } from "../the-forge/collection-route";

const COLLECTION = "enemies";

export const revalidate = 21600;

export async function generateMetadata() {
  return generateForgeCollectionMetadata(COLLECTION);
}

export default async function TheForgeEnemiesPage() {
  return renderForgeCollectionRoute(COLLECTION);
}
