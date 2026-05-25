import { generateForgeCollectionMetadata, renderForgeCollectionRoute } from "../the-forge/collection-route";

const COLLECTION = "npcs";

export const revalidate = 0;

export async function generateMetadata() {
  return generateForgeCollectionMetadata(COLLECTION);
}

export default async function TheForgeNpcsPage() {
  return renderForgeCollectionRoute(COLLECTION);
}
