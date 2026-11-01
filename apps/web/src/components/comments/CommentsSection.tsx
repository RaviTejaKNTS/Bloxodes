import { getApprovedComments } from "@/lib/comments";
import { CommentsClient } from "./CommentsClient";

type CommentsSectionProps = {
  entityType:
    | "code"
    | "article"
    | "catalog"
    | "event"
    | "tool"
    | "wiki"
    | "wiki_collection"
    | "game_wiki"
    | "game_collection"
    | "game_tool"
    | "game_code"
    | "game_map"
    | "game_quiz"
    | "game_catalog";
  entityId: string;
};

export async function CommentsSection({ entityType, entityId }: CommentsSectionProps) {
  const comments = await getApprovedComments(entityType, entityId);

  return <CommentsClient entityType={entityType} entityId={entityId} initialComments={comments} />;
}
