import { RailLinkList } from "@/components/RailLinkList";
import { getGameDirectoryPages } from "@/lib/game-registry";

export async function GameRelatedLinks({ namespace, gameId, canonicalPath }: { namespace: string; gameId?: string; canonicalPath: string }) {
  const pages = await getGameDirectoryPages(namespace, gameId);
  const candidates = pages.filter(page => page.href !== canonicalPath);
  const kinds = ["game_wiki_pages_view", "game_code_pages_view", "game_quiz_pages_view", "game_checklist_pages_view", "game_collection_pages_view", "game_tool_pages_view", "game_map_pages_view", "game_catalog_pages_view"];
  const firstOfEach = kinds.flatMap(kind => candidates.find(page => page.kind === kind) ?? []);
  const links = [...firstOfEach, ...candidates.filter(page => !firstOfEach.includes(page))].slice(0, 6);
  return <RailLinkList heading="Related pages" links={links} />;
}
