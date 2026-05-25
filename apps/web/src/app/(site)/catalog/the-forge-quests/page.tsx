import { generateForgeCollectionMetadata, renderForgeCollectionRoute } from "../the-forge/collection-route";

const COLLECTION = "quests";

export const revalidate = 0;

export async function generateMetadata() {
  return generateForgeCollectionMetadata(COLLECTION);
}

export default async function TheForgeQuestsPage() {
  return renderForgeCollectionRoute(COLLECTION);
}
