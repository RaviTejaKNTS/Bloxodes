import { generateForgeCollectionMetadata, renderForgeCollectionRoute } from "../the-forge/collection-route";

const COLLECTION = "essences";

export const revalidate = 86400;

export async function generateMetadata() {
  return generateForgeCollectionMetadata(COLLECTION);
}

export default async function TheForgeEssencesPage() {
  return renderForgeCollectionRoute(COLLECTION);
}
