import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { fetchStatsGames } from "../../src/api";
import { compactNumber, percentLabel } from "../../src/format";
import { radii, spacing } from "../../src/theme";
import { useTheme } from "../../src/theme-context";
import { AppIcon, EmptyState, ErrorState, LoadingState, MetaText, SearchBar } from "../../src/components/ui";
import type { StatsGame } from "../../src/types";

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "playing", label: "Playing now" },
  { value: "visits", label: "Visits" },
  { value: "favorites", label: "Favorites" },
  { value: "rating", label: "Rating" }
];

function GameRow({ game, index, onPress }: { game: StatsGame; index: number; onPress: () => void }) {
  const { colors } = useTheme();
  const growth = percentLabel(game.growth24hPercent);
  const growthPositive = typeof game.growth24hPercent === "number" && game.growth24hPercent >= 0;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}
    >
      <Text style={{ width: 28, color: colors.muted, fontSize: 13, fontWeight: "800", textAlign: "center" }}>
        {game.rank ?? index + 1}
      </Text>
      <View style={{ width: 46, height: 46, borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.surfaceMuted }}>
        {game.iconUrl ? (
          <Image source={{ uri: game.iconUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.muted, fontSize: 16, fontWeight: "900" }}>
              {(game.displayName || game.name).slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }} numberOfLines={1}>
          {game.displayName || game.name}
        </Text>
        <MetaText>{[game.genre, game.creatorName].filter(Boolean).join(" · ") || "Roblox"}</MetaText>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "800" }}>
          {compactNumber(game.playing) ?? "—"}
        </Text>
        {growth ? (
          <Text style={{ color: growthPositive ? "#22c55e" : colors.danger, fontSize: 11.5, fontWeight: "800" }}>{growth}</Text>
        ) : (
          <MetaText>playing</MetaText>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function StatsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [games, setGames] = useState<StatsGame[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState("playing");
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (nextPage: number, nextQuery: string, nextSort: string, append: boolean) => {
    const id = ++requestId.current;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await fetchStatsGames({ page: nextPage, q: nextQuery, sort: nextSort });
      if (id !== requestId.current) return;
      setGames((prev) => (append ? [...prev, ...response.games] : response.games));
      setPage(response.page);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (loadError) {
      if (id !== requestId.current) return;
      setError(loadError instanceof Error ? loadError.message : "Failed to load stats");
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(1, "", "playing", false);
  }, [load]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = searchText.trim();
      if (trimmed === query) return;
      setQuery(trimmed);
      void load(1, trimmed, sort, false);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchText, query, sort, load]);

  const canLoadMore = page < totalPages && !loading && !loadingMore;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={games}
        keyExtractor={(item) => String(item.universeId)}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
            <SearchBar value={searchText} onChangeText={setSearchText} placeholder="Search Roblox games" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {SORT_OPTIONS.map((option) => {
                const active = option.value === sort;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => {
                      if (active) return;
                      setSort(option.value);
                      void load(1, query, option.value, false);
                    }}
                    activeOpacity={0.85}
                    style={{
                      minHeight: 34,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? colors.accentBorder : colors.border,
                      backgroundColor: active ? colors.accentSoft : colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: spacing.md
                    }}
                  >
                    <Text style={{ color: active ? colors.accent : colors.mutedStrong, fontSize: 12.5, fontWeight: "800" }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <MetaText>{total ? `${total.toLocaleString("en-US")} games tracked` : " "}</MetaText>
            {loading && !games.length ? <LoadingState label="Loading live game stats" /> : null}
            {error && !games.length ? <ErrorState message={error} onRetry={() => void load(1, query, sort, false)} /> : null}
            {!loading && !error && !games.length ? <EmptyState title="No games found" body="Try a different search term." /> : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <GameRow game={item} index={index} onPress={() => router.push(`/stats/${item.universeId}` as never)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.borderMuted }} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (canLoadMore) {
            void load(page + 1, query, sort, true);
          }
        }}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: spacing.lg, alignItems: "center" }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : canLoadMore ? (
            <View style={{ paddingVertical: spacing.md, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: spacing.sm }}>
              <AppIcon name="chevrons-down" size={14} color={colors.muted} />
              <MetaText>Scroll for more</MetaText>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(1, query, sort, false);
            }}
            tintColor={colors.accent}
          />
        }
      />
    </View>
  );
}
