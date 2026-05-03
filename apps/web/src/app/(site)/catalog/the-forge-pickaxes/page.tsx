import { generateForgeCollectionMetadata, renderForgeCollectionRoute } from "../the-forge/collection-route";

const COLLECTION = "pickaxes";

export const revalidate = 86400;

export async function generateMetadata() {
  return generateForgeCollectionMetadata(COLLECTION);
}

export default async function TheForgePickaxesPage() {
  return renderForgeCollectionRoute(COLLECTION);
}
