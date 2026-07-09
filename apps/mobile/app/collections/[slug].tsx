import { useLocalSearchParams } from "expo-router";
import { ContentDetailScreen } from "../../src/screens/content-detail-screen";

export default function CollectionDetailRoute() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = typeof params.slug === "string" ? decodeURIComponent(params.slug) : "";
  return <ContentDetailScreen kind="catalog" slug={slug} />;
}
