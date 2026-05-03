import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import { fetchCodeDetail, fetchCodesIndex } from "./src/api";
import { colors, radii, spacing } from "./src/theme";
import type { CodeDetailResponse, CodeItem, CodesIndexItem } from "./src/types";

const NAV_ITEMS = [
  "Catalog",
  "Tools",
  "Wiki",
  "Codes",
  "Quizzes",
  "Lists",
  "Checklists",
  "Events",
  "Articles"
] as const;

type Screen = {
  name: "codes" | "codeDetail";
  slug?: string;
};

function formatDate(value: string | null): string {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function stripMarkdown(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function AppShell({
  children,
  currentScreen,
  drawerOpen,
  setDrawerOpen
}: {
  children: JSX.Element;
  currentScreen: Screen;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}) {
  const { height, width } = useWindowDimensions();
  const sidebarVisible = width >= 780;

  return (
    <SafeAreaView style={[styles.safeArea, { minHeight: height }]}>
      <StatusBar style="dark" />
      <View style={styles.appFrame}>
        {sidebarVisible ? <Sidebar currentScreen={currentScreen} /> : null}
        <View style={styles.mainColumn}>
          {!sidebarVisible ? (
            <View style={styles.topBar}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Open navigation"
                onPress={() => setDrawerOpen(true)}
                style={styles.iconButton}
              >
                <Text style={styles.iconButtonText}>Menu</Text>
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>Bloxodes</Text>
            </View>
          ) : null}
          {children}
        </View>
      </View>
      {!sidebarVisible && drawerOpen ? (
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={styles.drawerScrim} onPress={() => setDrawerOpen(false)} />
          <View style={styles.drawerPanel}>
            <Sidebar currentScreen={currentScreen} compact onClose={() => setDrawerOpen(false)} />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Sidebar({ currentScreen, compact, onClose }: { currentScreen: Screen; compact?: boolean; onClose?: () => void }) {
  return (
    <View style={[styles.sidebar, compact ? styles.sidebarCompact : null]}>
      <View style={styles.brandBlock}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>B</Text>
        </View>
        <View>
          <Text style={styles.brandTitle}>Bloxodes</Text>
          <Text style={styles.brandSubTitle}>Roblox hub</Text>
        </View>
      </View>
      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const active = item === "Codes" && currentScreen.name.startsWith("code");
          const enabled = item === "Codes";
          return (
            <TouchableOpacity
              key={item}
              accessibilityRole="button"
              disabled={!enabled}
              onPress={onClose}
              style={[styles.navItem, active ? styles.navItemActive : null, !enabled ? styles.navItemDisabled : null]}
            >
              <Text style={[styles.navItemText, active ? styles.navItemTextActive : null]}>{item}</Text>
              {!enabled ? <Text style={styles.navItemMeta}>Later</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function CodesIndexScreen({
  games,
  loading,
  refreshing,
  error,
  total,
  page,
  totalPages,
  onRefresh,
  onLoadMore,
  onSelectGame
}: {
  games: CodesIndexItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
  onRefresh: () => void;
  onLoadMore: () => void;
  onSelectGame: (slug: string) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>Roblox Codes Hub</Text>
        <Text style={styles.pageTitle}>Fresh Roblox game codes</Text>
        <Text style={styles.pageDescription}>
          Find active codes for Roblox games, then open a code page for rewards, copy actions, and update details.
        </Text>
        <View style={styles.statsRow}>
          <Pill label={`${total || games.length} games tracked`} />
          <Pill label="Updated daily" />
        </View>
      </View>

      {error ? <ErrorPanel message={error} onRetry={onRefresh} /> : null}
      {loading && games.length === 0 ? <LoadingPanel /> : null}

      <View style={styles.grid}>
        {games.map((game) => (
          <TouchableOpacity key={game.id} style={styles.gameCard} onPress={() => onSelectGame(game.slug)}>
            <ImageSlot source={game.coverImage} label={game.name} />
            <View style={styles.gameCardBody}>
              <View style={styles.cardHeaderLine}>
                <Text style={styles.gameTitle} numberOfLines={2}>
                  {game.name}
                </Text>
                <Text style={styles.countBadge}>{game.activeCount} active</Text>
              </View>
              <Text style={styles.mutedText} numberOfLines={1}>
                Updated {formatDate(game.contentUpdatedAt)}
              </Text>
              {game.genre ? <Text style={styles.genreText}>{game.genre}</Text> : null}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {games.length > 0 && page < totalPages ? (
        <TouchableOpacity style={styles.loadMoreButton} onPress={onLoadMore} disabled={loading}>
          <Text style={styles.loadMoreText}>{loading ? "Loading" : "Load more"}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

function CodeDetailScreen({
  detail,
  loading,
  error,
  onBack,
  onRetry
}: {
  detail: CodeDetailResponse | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
}) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  async function copyCode(code: string) {
    await Clipboard.setStringAsync(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>Back to codes</Text>
      </TouchableOpacity>

      {loading ? <LoadingPanel /> : null}
      {error ? <ErrorPanel message={error} onRetry={onRetry} /> : null}

      {detail ? (
        <>
          <View style={styles.detailHero}>
            <ImageSlot source={detail.game.coverImage} label={detail.game.name} tall />
            <View style={styles.detailHeroText}>
              <Text style={styles.eyebrow}>Roblox Codes</Text>
              <Text style={styles.pageTitle}>{detail.game.name} Codes</Text>
              <Text style={styles.pageDescription} numberOfLines={4}>
                {stripMarkdown(detail.game.description) ?? "Active and expired codes tracked by Bloxodes."}
              </Text>
              <View style={styles.statsRow}>
                <Pill label={`${detail.activeCodes.length} active`} />
                <Pill label={`Updated ${formatDate(detail.game.contentUpdatedAt)}`} />
              </View>
            </View>
          </View>

          <CodesPanel
            title={`Active ${detail.game.name} Codes`}
            subtitle={`Checked and verified on ${formatDate(detail.game.contentUpdatedAt)}`}
            badge={`${detail.activeCodes.length} active`}
            codes={detail.activeCodes}
            copiedCode={copiedCode}
            onCopy={copyCode}
            emptyTitle="No active codes right now"
            emptyBody="Bloxodes has a page for this game, but no working codes are confirmed at the moment."
          />

          <CodesPanel
            title="Expired codes"
            subtitle="These codes are no longer confirmed as working."
            badge={`${detail.expiredCodes.length} expired`}
            codes={detail.expiredCodes}
            copiedCode={copiedCode}
            onCopy={copyCode}
            emptyTitle="No expired codes listed"
            emptyBody="We have not archived expired codes for this game yet."
            muted
          />

          <View style={styles.externalLinks}>
            <TouchableOpacity style={styles.outlineButton} onPress={() => Linking.openURL(detail.game.url)}>
              <Text style={styles.outlineButtonText}>Open on Bloxodes</Text>
            </TouchableOpacity>
            {detail.game.robloxUrl ? (
              <TouchableOpacity style={styles.outlineButton} onPress={() => Linking.openURL(detail.game.robloxUrl!)}>
                <Text style={styles.outlineButtonText}>Open Roblox game</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function CodesPanel({
  title,
  subtitle,
  badge,
  codes,
  copiedCode,
  onCopy,
  emptyTitle,
  emptyBody,
  muted
}: {
  title: string;
  subtitle: string;
  badge: string;
  codes: CodeItem[];
  copiedCode: string | null;
  onCopy: (code: string) => void;
  emptyTitle: string;
  emptyBody: string;
  muted?: boolean;
}) {
  return (
    <View style={[styles.codesPanel, muted ? styles.codesPanelMuted : null]}>
      <View style={styles.codesPanelHeader}>
        <View style={styles.panelHeading}>
          <Text style={styles.panelTitle}>{title}</Text>
          <Text style={styles.panelSubtitle}>✓ {subtitle}</Text>
        </View>
        <Text style={styles.countBadge}>{badge}</Text>
      </View>
      <View style={styles.codesList}>
        {codes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.mutedText}>{emptyBody}</Text>
          </View>
        ) : (
          codes.map((code, index) => (
            <View key={code.id} style={[styles.codeRow, index > 0 ? styles.codeRowBorder : null]}>
              <View style={styles.codeIndex}>
                <Text style={styles.codeIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.codeMain}>
                <View style={styles.codeLine}>
                  <Text style={styles.codeText}>{code.code}</Text>
                  {code.isNew ? <Text style={styles.miniBadge}>New</Text> : null}
                  {code.levelRequirement != null ? <Text style={styles.miniBadge}>Level {code.levelRequirement}+</Text> : null}
                </View>
                <Text style={styles.mutedText} numberOfLines={2}>
                  {code.rewardText ? `You get ${code.rewardText}` : "No reward listed yet."}
                </Text>
                <Text style={styles.addedText}>Added {formatDate(code.firstSeenAt)}</Text>
              </View>
              <TouchableOpacity style={[styles.copyButton, copiedCode === code.code ? styles.copyButtonDone : null]} onPress={() => onCopy(code.code)}>
                <Text style={[styles.copyButtonText, copiedCode === code.code ? styles.copyButtonDoneText : null]}>
                  {copiedCode === code.code ? "Copied" : "Copy"}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function ImageSlot({ source, label, tall }: { source: string | null; label: string; tall?: boolean }) {
  if (!source) {
    return (
      <View style={[styles.imageFallback, tall ? styles.imageTall : null]}>
        <Text style={styles.imageFallbackText}>{label.slice(0, 1).toUpperCase()}</Text>
      </View>
    );
  }

  return <Image source={{ uri: source }} style={[styles.image, tall ? styles.imageTall : null]} resizeMode="cover" />;
}

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function LoadingPanel() {
  return (
    <View style={styles.statePanel}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.stateText}>Loading Bloxodes codes</Text>
    </View>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.statePanel}>
      <Text style={styles.errorTitle}>Bloxodes did not respond</Text>
      <Text style={styles.mutedText}>{message}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "codes" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [games, setGames] = useState<CodesIndexItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [indexLoading, setIndexLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CodeDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const currentSlug = screen.name === "codeDetail" ? screen.slug : undefined;

  async function loadIndex(nextPage = 1, replace = true) {
    setIndexLoading(true);
    setIndexError(null);
    try {
      const response = await fetchCodesIndex(nextPage);
      setGames((prev) => (replace ? response.games : [...prev, ...response.games]));
      setPage(response.page);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (error) {
      setIndexError(error instanceof Error ? error.message : "Failed to load codes");
    } finally {
      setIndexLoading(false);
      setRefreshing(false);
    }
  }

  async function refreshIndex() {
    setRefreshing(true);
    await loadIndex(1, true);
  }

  async function loadDetail(slug: string) {
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetchCodeDetail(slug);
      setDetail(response);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Failed to load code page");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadIndex(1, true);
  }, []);

  useEffect(() => {
    if (currentSlug) {
      void loadDetail(currentSlug);
    }
  }, [currentSlug]);

  const content = useMemo(() => {
    if (screen.name === "codeDetail") {
      return (
        <CodeDetailScreen
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onBack={() => setScreen({ name: "codes" })}
          onRetry={() => currentSlug && void loadDetail(currentSlug)}
        />
      );
    }

    return (
      <CodesIndexScreen
        games={games}
        loading={indexLoading}
        refreshing={refreshing}
        error={indexError}
        total={total}
        page={page}
        totalPages={totalPages}
        onRefresh={() => void refreshIndex()}
        onLoadMore={() => void loadIndex(page + 1, false)}
        onSelectGame={(slug) => setScreen({ name: "codeDetail", slug })}
      />
    );
  }, [currentSlug, detail, detailError, detailLoading, games, indexError, indexLoading, page, refreshing, screen.name, total, totalPages]);

  return (
    <AppShell currentScreen={screen} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}>
      {content}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  appFrame: {
    flex: 1,
    backgroundColor: colors.background,
    flexDirection: "row"
  },
  sidebar: {
    width: 244,
    backgroundColor: "#f1f3f8",
    borderRightWidth: 1,
    borderRightColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xl
  },
  sidebarCompact: {
    width: 284,
    height: "100%"
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.foreground,
    alignItems: "center",
    justifyContent: "center"
  },
  brandMarkText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800"
  },
  brandTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "700"
  },
  brandSubTitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  navList: {
    gap: spacing.xs
  },
  navItem: {
    minHeight: 42,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  navItemActive: {
    backgroundColor: colors.surfaceMuted
  },
  navItemDisabled: {
    opacity: 0.58
  },
  navItemText: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600"
  },
  navItemTextActive: {
    color: colors.accent
  },
  navItemMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600"
  },
  mainColumn: {
    flex: 1
  },
  topBar: {
    height: 58,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  iconButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  iconButtonText: {
    color: colors.foreground,
    fontWeight: "700"
  },
  topBarTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "700"
  },
  drawerOverlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    flexDirection: "row",
    zIndex: 20
  },
  drawerScrim: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    backgroundColor: "rgba(32, 38, 60, 0.28)"
  },
  drawerPanel: {
    height: "100%"
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: 48
  },
  headerBlock: {
    gap: spacing.sm,
    maxWidth: 760
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  pageTitle: {
    color: colors.foreground,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700"
  },
  pageDescription: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  pillText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  grid: {
    gap: spacing.md
  },
  gameCard: {
    overflow: "hidden",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  image: {
    width: "100%",
    height: 142,
    backgroundColor: colors.surfaceMuted
  },
  imageTall: {
    height: 210
  },
  imageFallback: {
    width: "100%",
    height: 142,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  imageFallbackText: {
    color: colors.muted,
    fontSize: 40,
    fontWeight: "800"
  },
  gameCardBody: {
    padding: spacing.md,
    gap: spacing.sm
  },
  cardHeaderLine: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  gameTitle: {
    flex: 1,
    color: colors.foreground,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700"
  },
  countBadge: {
    overflow: "hidden",
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  mutedText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  genreText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700"
  },
  loadMoreButton: {
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.4)",
    borderRadius: 999,
    backgroundColor: "rgba(79, 70, 229, 0.15)",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md
  },
  loadMoreText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "800"
  },
  backButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  backButtonText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "700"
  },
  detailHero: {
    overflow: "hidden",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  detailHeroText: {
    padding: spacing.lg,
    gap: spacing.sm
  },
  codesPanel: {
    overflow: "hidden",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  codesPanelMuted: {
    opacity: 0.92
  },
  codesPanelHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  panelHeading: {
    flex: 1,
    gap: spacing.xs
  },
  panelTitle: {
    color: colors.foreground,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700"
  },
  panelSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
  },
  codesList: {
    padding: spacing.md
  },
  codeRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.md,
    alignItems: "center"
  },
  codeRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  codeIndex: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: "rgba(212, 215, 231, 0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  codeIndexText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  codeMain: {
    flex: 1,
    gap: 5
  },
  codeLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    alignItems: "center"
  },
  codeText: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1
  },
  miniBadge: {
    overflow: "hidden",
    borderRadius: radii.sm,
    backgroundColor: "rgba(79, 70, 229, 0.12)",
    color: colors.accent,
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 3,
    textTransform: "uppercase"
  },
  addedText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600"
  },
  copyButton: {
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.4)",
    borderRadius: 999,
    backgroundColor: "rgba(79, 70, 229, 0.15)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  copyButtonDone: {
    backgroundColor: colors.accentDark,
    borderColor: colors.accentDark
  },
  copyButtonText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800"
  },
  copyButtonDoneText: {
    color: colors.white
  },
  emptyState: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: "rgba(212, 215, 231, 0.2)",
    padding: spacing.md,
    gap: spacing.xs
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700"
  },
  externalLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  outlineButtonText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "800"
  },
  statePanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: "flex-start"
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600"
  },
  errorTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800"
  },
  retryButton: {
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.4)",
    borderRadius: 999,
    backgroundColor: "rgba(79, 70, 229, 0.15)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  retryButtonText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800"
  }
});
