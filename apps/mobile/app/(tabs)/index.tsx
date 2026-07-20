import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchMobileHome } from "../../src/api";
import { formatUpdatedLabel } from "../../src/format";
import { routeForWebUrl, SECTION_LABELS } from "../../src/links";
import { spacing } from "../../src/theme";
import { useTheme } from "../../src/theme-context";
import { ContentCard } from "../../src/components/content";
import { AppIcon, Badge, Card, CoverImage, ErrorState, LoadingState, MetaText, SectionHeader } from "../../src/components/ui";
import type { CodesIndexItem, MobileContentIndexResponse, MobileHomeResponse } from "../../src/types";

const LOGO_LIGHT = require("../../assets/Bloxodes-light.png");
const LOGO_DARK = require("../../assets/Bloxodes-dark.png");

const RAIL_CARD_WIDTH = 220;

function HomeHeader() {
  const { colors, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.background
      }}
    >
      <Image
        source={isDark ? LOGO_DARK : LOGO_LIGHT}
        resizeMode="contain"
        style={{ width: 118, height: 40 }}
        accessibilityLabel="Bloxodes"
      />
      <TouchableOpacity
        onPress={toggleTheme}
        activeOpacity={0.8}
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <AppIcon name={isDark ? "sun" : "moon"} color={colors.foreground} size={16} />
      </TouchableOpacity>
    </View>
  );
}

function CodesRailCard({ game, onPress }: { game: CodesIndexItem; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={{ width: RAIL_CARD_WIDTH }}>
      <CoverImage source={game.coverImage} label={game.name} />
      <View style={{ gap: spacing.xs, padding: spacing.md }}>
        <Badge label={`${game.activeCount} active`} tone="accent" />
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }} numberOfLines={2}>
          {game.name} Codes
        </Text>
        <MetaText>Updated {formatUpdatedLabel(game.contentUpdatedAt)}</MetaText>
      </View>
    </Card>
  );
}

function SectionRail({ section }: { section: MobileContentIndexResponse }) {
  const router = useRouter();
  if (!section.items.length) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <SectionHeader
          title={SECTION_LABELS[section.kind]}
          subtitle={`${section.total} pages`}
          action="View all"
          onAction={() => router.push(`/section/${section.kind}` as never)}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
        {section.items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            width={RAIL_CARD_WIDTH}
            onPress={() => {
              const route = routeForWebUrl(item.url);
              if (route) {
                router.push(route as never);
              } else {
                void Linking.openURL(item.url);
              }
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [home, setHome] = useState<MobileHomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const payload = await fetchMobileHome();
      setHome(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load home");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <HomeHeader />
      <ScrollView
        contentContainerStyle={{ gap: spacing.xl, paddingVertical: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.accent}
          />
        }
      >
        <View style={{ gap: spacing.xs, paddingHorizontal: spacing.lg }}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
            Roblox Live Database
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 26, lineHeight: 32, fontWeight: "800" }}>
            Codes, stats, and game data in one place.
          </Text>
        </View>

        {loading ? <LoadingState label="Loading Bloxodes" /> : null}
        {error && !home ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        {home?.codes.games.length ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <SectionHeader
                title="Codes"
                subtitle={`${home.codes.total} games tracked`}
                action="View all"
                onAction={() => router.push("/codes" as never)}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
            >
              {home.codes.games.map((game) => (
                <CodesRailCard key={game.id} game={game} onPress={() => router.push(`/codes/${game.slug}` as never)} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {home?.sections.map((section) => <SectionRail key={section.kind} section={section} />)}
      </ScrollView>
    </View>
  );
}
