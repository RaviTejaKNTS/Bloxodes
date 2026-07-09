import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { fetchContentDetail } from "../api";
import { CollectionDetailView, DetailSectionCard } from "../components/content";
import { Badge, Button, Card, CoverImage, EmptyState, ErrorState, LoadingState, MetaText } from "../components/ui";
import { formatUpdatedLabel } from "../format";
import { spacing } from "../theme";
import { useTheme } from "../theme-context";
import type { MobileContentDetailItem, MobileContentDetailResponse, MobileContentDetailSection, MobileContentKind } from "../types";

function routeForSectionItem(kind: MobileContentKind, sectionId: string, item: MobileContentDetailItem): string | null {
  if (kind === "wiki") {
    if (sectionId === "codes") return `/codes/${encodeURIComponent(item.id)}`;
    if (sectionId === "quizzes") return `/quiz/${encodeURIComponent(item.id)}`;
    if (sectionId === "checklists") return `/checklist/${encodeURIComponent(item.id)}`;
    if (sectionId === "catalog") return `/collections/${encodeURIComponent(item.id)}`;
    if (sectionId === "tools") return `/section/tools/${encodeURIComponent(item.id)}`;
    if (sectionId === "events") return `/section/events/${encodeURIComponent(item.id)}`;
  }
  if (kind === "catalog" && sectionId === "related-catalogs") {
    return `/section/catalog/${encodeURIComponent(item.id)}`;
  }
  if (kind === "catalog" && sectionId === "collection-nav") {
    return `/collections/${encodeURIComponent(item.id)}`;
  }
  return null;
}

export function ContentDetailScreen({
  kind,
  redirectLegacyCollectionUrl = false,
  slug
}: {
  kind: MobileContentKind | null;
  redirectLegacyCollectionUrl?: boolean;
  slug: string;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const [detail, setDetail] = useState<MobileContentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectionPages, setSectionPages] = useState<Record<string, number>>({});
  const [loadingSectionId, setLoadingSectionId] = useState<string | null>(null);
  const accumulated = useRef<Record<string, MobileContentDetailItem[]>>({});

  const load = useCallback(
    async (pages: Record<string, number>, appendSectionId: string | null) => {
      if (!kind || !slug) return;
      if (appendSectionId) {
        setLoadingSectionId(appendSectionId);
      } else {
        setLoading(true);
        accumulated.current = {};
      }
      setError(null);
      try {
        const response = await fetchContentDetail(kind, slug, pages);
        const merged = {
          ...response,
          sections: response.sections.map((section) => {
            if (appendSectionId && section.id === appendSectionId) {
              const previous = accumulated.current[section.id] ?? [];
              const items = [...previous, ...section.items];
              accumulated.current[section.id] = items;
              return { ...section, items } satisfies MobileContentDetailSection;
            }
            accumulated.current[section.id] = section.items;
            return section;
          })
        };
        setDetail((prev) => {
          if (!appendSectionId || !prev) return merged;
          return {
            ...merged,
            sections: merged.sections.map((section) => {
              if (section.id === appendSectionId) return section;
              const existing = prev.sections.find((entry) => entry.id === section.id);
              return existing ?? section;
            })
          };
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load page");
      } finally {
        setLoading(false);
        setLoadingSectionId(null);
      }
    },
    [kind, slug]
  );

  useEffect(() => {
    void load({}, null);
  }, [load]);

  useEffect(() => {
    if (redirectLegacyCollectionUrl && detail?.layout === "wiki_collection" && slug) {
      router.replace(`/collections/${encodeURIComponent(slug)}` as never);
    }
  }, [detail?.layout, redirectLegacyCollectionUrl, router, slug]);

  const itemPressHandler = useMemo(() => {
    if (!kind || !detail) return undefined;
    return (sectionId: string) => (item: MobileContentDetailItem) => {
      const route = routeForSectionItem(kind, sectionId, item);
      if (!route) return null;
      return () => router.push(route as never);
    };
  }, [kind, detail, router]);

  if (!kind || !slug) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState title="Page not found" />
      </View>
    );
  }

  function loadMoreSection(section: MobileContentDetailSection) {
    const nextPage = (section.page ?? 1) + 1;
    const nextPages = { ...sectionPages, [section.id]: nextPage };
    setSectionPages(nextPages);
    void load(nextPages, section.id);
  }

  return (
    <>
      <Stack.Screen options={{ title: detail?.title ?? "" }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }}
      >
        {loading ? <LoadingState label="Loading page" /> : null}
        {error && !detail ? <ErrorState message={error} onRetry={() => void load(sectionPages, null)} /> : null}

        {detail ? (
          detail.layout === "wiki_collection" ? (
            <CollectionDetailView
              detail={detail}
              itemPressHandler={itemPressHandler}
              onOpenWeb={() => void Linking.openURL(detail.url)}
            />
          ) : (
            <>
              <Card>
                <CoverImage source={detail.coverImage} label={detail.title} />
                <View style={{ gap: spacing.sm, padding: spacing.lg }}>
                  {detail.badge ? <Badge label={detail.badge} tone="accent" /> : null}
                  <Text style={{ color: colors.foreground, fontSize: 22, lineHeight: 28, fontWeight: "800" }}>{detail.title}</Text>
                  {detail.subtitle ? (
                    <Text style={{ color: colors.mutedStrong, fontSize: 14, fontWeight: "600" }}>{detail.subtitle}</Text>
                  ) : null}
                  {detail.updatedAt ? <MetaText>Updated {formatUpdatedLabel(detail.updatedAt)}</MetaText> : null}
                </View>
              </Card>

              {detail.sections
                .filter((section) => section.body || section.items.length)
                .map((section) => (
                  <DetailSectionCard
                    key={section.id}
                    section={section}
                    loadingMore={loadingSectionId === section.id}
                    onLoadMore={() => loadMoreSection(section)}
                    itemPressHandler={itemPressHandler ? itemPressHandler(section.id) : undefined}
                  />
                ))}

              <Button
                icon="external-link"
                label="Open on bloxodes.com"
                variant="secondary"
                onPress={() => void Linking.openURL(detail.url)}
              />
            </>
          )
        ) : null}
      </ScrollView>
    </>
  );
}
