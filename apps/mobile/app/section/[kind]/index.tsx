import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Linking, RefreshControl, View, useWindowDimensions } from "react-native";
import { fetchContentIndex } from "../../../src/api";
import { isSectionKind, routeForWebUrl, SECTION_LABELS } from "../../../src/links";
import { spacing } from "../../../src/theme";
import { useTheme } from "../../../src/theme-context";
import { ContentCard, ContentRow } from "../../../src/components/content";
import { EmptyState, ErrorState, LoadingState, MetaText, SearchBar } from "../../../src/components/ui";
import type { MobileContentItem, MobileContentKind } from "../../../src/types";

const PAGE_SIZE = 24;

// These kinds use square game icons as covers, which crop badly in 16:9 grid
// cards; render them as list rows with square thumbnails instead.
const LIST_KINDS: MobileContentKind[] = ["wiki", "quizzes", "checklists"];

export default function SectionIndexScreen() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind = isSectionKind(params.kind) ? params.kind : null;
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<MobileContentItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const asList = kind ? LIST_KINDS.includes(kind) : false;
  const columns = asList ? 1 : width >= 700 ? 3 : 2;
  const cardGap = asList ? 0 : spacing.md;
  const cardWidth = (width - spacing.lg * 2 - spacing.md * (columns - 1)) / columns;

  const load = useCallback(
    async (nextPage: number, nextQuery: string, append: boolean) => {
      if (!kind) return;
      const id = ++requestId.current;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await fetchContentIndex(kind, nextPage, nextQuery, PAGE_SIZE);
        if (id !== requestId.current) return;
        setItems((prev) => (append ? [...prev, ...response.items] : response.items));
        setPage(response.page);
        setTotal(response.total);
        setTotalPages(response.totalPages);
      } catch (loadError) {
        if (id !== requestId.current) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load content");
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [kind]
  );

  useEffect(() => {
    void load(1, "", false);
  }, [load]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = searchText.trim();
      if (trimmed === query) return;
      setQuery(trimmed);
      void load(1, trimmed, false);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchText, query, load]);

  function openItem(item: MobileContentItem) {
    const route = routeForWebUrl(item.url);
    if (route) {
      router.push(route as never);
    } else {
      void Linking.openURL(item.url);
    }
  }

  if (!kind) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState title="Section not found" />
      </View>
    );
  }

  const canLoadMore = page < totalPages && !loading && !loadingMore;

  return (
    <>
      <Stack.Screen options={{ title: SECTION_LABELS[kind] }} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <FlatList
          data={items}
          key={columns}
          numColumns={columns}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={columns > 1 ? { gap: cardGap } : undefined}
          contentContainerStyle={{ gap: cardGap, padding: spacing.lg, paddingBottom: spacing.xxl }}
          ListHeaderComponent={
            <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
              <SearchBar
                value={searchText}
                onChangeText={setSearchText}
                placeholder={`Search ${SECTION_LABELS[kind].toLowerCase()}`}
              />
              <MetaText>{total ? `${total} pages` : " "}</MetaText>
              {loading && !items.length ? <LoadingState label={`Loading ${SECTION_LABELS[kind].toLowerCase()}`} /> : null}
              {error && !items.length ? <ErrorState message={error} onRetry={() => void load(1, query, false)} /> : null}
              {!loading && !error && !items.length ? (
                <EmptyState title="Nothing here yet" body="Try a different search term." />
              ) : null}
            </View>
          }
          renderItem={({ item, index }) =>
            asList ? (
              <View
                style={{
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: colors.borderMuted
                }}
              >
                <ContentRow item={item} onPress={() => openItem(item)} />
              </View>
            ) : (
              <ContentCard item={item} width={cardWidth} onPress={() => openItem(item)} />
            )
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (canLoadMore) {
              void load(page + 1, query, true);
            }
          }}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: spacing.lg, alignItems: "center" }}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(1, query, false);
              }}
              tintColor={colors.accent}
            />
          }
        />
      </View>
    </>
  );
}
