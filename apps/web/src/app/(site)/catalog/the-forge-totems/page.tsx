import { generateForgeCollectionMetadata, renderForgeCollectionRoute } from "../the-forge/collection-route";

const COLLECTION = "totems";

export const revalidate = 0;

export async function generateMetadata() {
  return generateForgeCollectionMetadata(COLLECTION);
}

export default async function TheForgeTotemsPage() {
  return renderForgeCollectionRoute(COLLECTION);
}
