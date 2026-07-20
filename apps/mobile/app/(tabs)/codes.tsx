import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View, useWindowDimensions } from "react-native";
import { fetchCodesIndex } from "../../src/api";
import { formatUpdatedLabel } from "../../src/format";
import { radii, spacing } from "../../src/theme";
import { useTheme } from "../../src/theme-context";
import { AppIcon, Badge, Card, CoverImage, EmptyState, ErrorState, LoadingState, MetaText, SearchBar } from "../../src/components/ui";
import type { CodesIndexItem } from "../../src/types";

const PAGE_SIZE = 24;

function CodesGridCard({ game, onPress, width }: { game: CodesIndexItem; onPress: () => void; width: number }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={{ width }}>
      <CoverImage source={game.coverImage} label={game.name} />
      <View style={{ gap: spacing.xs, padding: spacing.md }}>
        {game.genre ? (
          <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700", textTransform: "uppercase" }} numberOfLines={1}>
            {game.genre}
          </Text>
        ) : null}
        <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 20, fontWeight: "800" }} numberOfLines={2}>
          {game.name} Codes
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: "#4ade80" }} />
            <MetaText>{game.activeCount} active</MetaText>
          </View>
          <MetaText>{formatUpdatedLabel(game.contentUpdatedAt)}</MetaText>
        </View>
      </View>
    </Card>
  );
}

export default function CodesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [games, setGames] = useState<CodesIndexItem[]>([]);
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

  const columns = width >= 700 ? 3 : 2;
  const cardGap = spacing.md;
  const cardWidth = (width - spacing.lg * 2 - cardGap * (columns - 1)) / columns;

  const load = useCallback(async (nextPage: number, nextQuery: string, append: boolean) => {
    const id = ++requestId.current;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await fetchCodesIndex(nextPage, PAGE_SIZE, nextQuery);
      if (id !== requestId.current) return;
      setGames((prev) => (append ? [...prev, ...response.games] : response.games));
      setPage(response.page);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (loadError) {
      if (id !== requestId.current) return;
      setError(loadError instanceof Error ? loadError.message : "Failed to load codes");
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(1, "", false);
  }, [load]);

  // Debounced live search.
  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = searchText.trim();
      if (trimmed === query) return;
      setQuery(trimmed);
      void load(1, trimmed, false);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchText, query, load]);

  const canLoadMore = page < totalPages && !loading && !loadingMore;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={games}
        key={columns}
        numColumns={columns}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={{ gap: cardGap }}
        contentContainerStyle={{ gap: cardGap, padding: spacing.lg, paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
            <SearchBar value={searchText} onChangeText={setSearchText} placeholder="Search games with codes" />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <MetaText>{total ? `${total} games tracked` : " "}</MetaText>
              {query ? <Badge label={`Search: ${query}`} tone="accent" /> : null}
            </View>
            {loading && !games.length ? <LoadingState label="Loading code pages" /> : null}
            {error && !games.length ? <ErrorState message={error} onRetry={() => void load(1, query, false)} /> : null}
            {!loading && !error && !games.length ? (
              <EmptyState title="No games found" body="Try a different search term." />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <CodesGridCard game={item} width={cardWidth} onPress={() => router.push(`/codes/${item.slug}` as never)} />
        )}
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
          ) : page < totalPages && games.length ? (
            <View
              style={{
                marginTop: spacing.sm,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm
              }}
            >
              <AppIcon name="chevrons-down" size={14} color={colors.muted} />
              <MetaText>Scroll for more · page {page} of {totalPages}</MetaText>
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
  );
}
