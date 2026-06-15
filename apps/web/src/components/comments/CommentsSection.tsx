import { getApprovedComments } from "@/lib/comments";
import { CommentsClient } from "./CommentsClient";

type CommentsSectionProps = {
  entityType: "code" | "article" | "catalog" | "event" | "list" | "tool" | "wiki" | "wiki_catalog";
  entityId: string;
};

export async function CommentsSection({ entityType, entityId }: CommentsSectionProps) {
  const comments = await getApprovedComments(entityType, entityId);

  return <CommentsClient entityType={entityType} entityId={entityId} initialComments={comments} />;
}
