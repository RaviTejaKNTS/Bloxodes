import { generateForgeCollectionMetadata, renderForgeCollectionRoute } from "../the-forge/collection-route";

const COLLECTION = "armors";

export const revalidate = 86400;

export async function generateMetadata() {
  return generateForgeCollectionMetadata(COLLECTION);
}

export default async function TheForgeArmorsPage() {
  return renderForgeCollectionRoute(COLLECTION);
}
