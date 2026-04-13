import { generateForgeCollectionMetadata, renderForgeCollectionRoute } from "../the-forge/collection-route";

const COLLECTION = "skills";

export const revalidate = 86400;

export async function generateMetadata() {
  return generateForgeCollectionMetadata(COLLECTION);
}

export default async function TheForgeSkillsPage() {
  return renderForgeCollectionRoute(COLLECTION);
}
