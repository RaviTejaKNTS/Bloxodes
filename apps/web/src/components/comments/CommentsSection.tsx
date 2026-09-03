import { getApprovedComments } from "@/lib/comments";
import { CommentsClient } from "./CommentsClient";

type CommentsSectionProps = {
  entityType: "code" | "article" | "catalog" | "event" | "tool" | "wiki" | "wiki_collection" | "gta_wiki" | "gta_wiki_collection";
  entityId: string;
};

export async function CommentsSection({ entityType, entityId }: CommentsSectionProps) {
  const comments = await getApprovedComments(entityType, entityId);

  return <CommentsClient entityType={entityType} entityId={entityId} initialComments={comments} />;
}
