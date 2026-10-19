import type { SharedGameWikiPage } from "@/lib/shared-game-reader";
import { renderGameWikiPage } from "./GameWikiPage";

export function GameWikiHub({ page, namespaceTitle }: { page: SharedGameWikiPage; namespaceTitle: string }) {
  return renderGameWikiPage({ page, namespace: page.namespace, namespaceTitle });
}
