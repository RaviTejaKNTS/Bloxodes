import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { isSectionKind } from "../../../src/links";
import { ContentDetailScreen } from "../../../src/screens/content-detail-screen";

export default function SectionDetailScreen() {
  const params = useLocalSearchParams<{ kind: string; slug: string }>();
  const kind = isSectionKind(params.kind) ? params.kind : null;
  const slug = typeof params.slug === "string" ? decodeURIComponent(params.slug) : "";
  const router = useRouter();

  useEffect(() => {
    if (params.kind === "quizzes" && slug) {
      router.replace(`/quiz/${encodeURIComponent(slug)}` as never);
    } else if (params.kind === "checklists" && slug) {
      router.replace(`/checklist/${encodeURIComponent(slug)}` as never);
    }
  }, [params.kind, slug, router]);

  return <ContentDetailScreen kind={kind} slug={slug} redirectLegacyCollectionUrl={kind === "catalog"} />;
}
