import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View
} from "react-native";
import { buildWebUrl, fetchCodeDetail, fetchCodesIndex, fetchContentIndex, fetchSearchResults } from "./src/api";
import { darkColors, lightColors, radii, spacing, type ThemeColors } from "./src/theme";
import type {
  CodeDetailResponse,
  CodeItem,
  CodesIndexItem,
  MobileContentIndexResponse,
  MobileContentItem,
  MobileContentKind,
  SearchItem
} from "./src/types";

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

type FeatherIconName = keyof typeof Feather.glyphMap;

const NAV_ITEM_ICONS: Record<(typeof NAV_ITEMS)[number], FeatherIconName> = {
  Catalog: "grid",
  Tools: "tool",
  Wiki: "book-open",
  Codes: "key",
  Quizzes: "award",
  Lists: "list",
  Checklists: "check-square",
  Events: "calendar",
  Articles: "file-text"
};

const LOGO_LIGHT = require("./assets/Bloxodes-light.png");
const LOGO_DARK = require("./assets/Bloxodes-dark.png");

const WEB_BREAKPOINT_MD = 768;
const WEB_BREAKPOINT_LG = 1024;
const WEB_BREAKPOINT_XL = 1280;
const SIDEBAR_WIDTH = 240;
const CONTENT_MAX_WIDTH = 940;
const CONTENT_PADDING = spacing.lg;
const CARD_GAP = 20;

type Screen = {
  name: "codes" | "codeDetail" | MobileContentKind;
  slug?: string;
};

type ContentSectionConfig = {
  description: string;
  eyebrow: string;
  icon: FeatherIconName;
  statNoun: string;
  title: string;
};

const CONTENT_SECTIONS: Record<MobileContentKind, ContentSectionConfig> = {
  articles: {
    description: "Fast links into Bloxodes guides and updates, with the useful context you need before opening the full page.",
    eyebrow: "Roblox Articles",
    icon: "file-text",
    statNoun: "articles published",
    title: "Roblox articles and guides"
  },
  catalog: {
    description: "Browse Roblox reference pages, item databases, IDs, game catalogs, and useful collections from Bloxodes.",
    eyebrow: "Roblox Catalog",
    icon: "grid",
    statNoun: "catalog pages",
    title: "Roblox catalog pages and databases"
  },
  tools: {
    description: "Currency converters, planning helpers, and utilities built to stay current with our latest data and guides.",
    eyebrow: "Roblox Utilities",
    icon: "tool",
    statNoun: "tools published",
    title: "Roblox tools and calculators to plan faster"
  },
  quizzes: {
    description: "Quick, replayable quizzes built from in-game mechanics, NPCs, and regions. Pick a game and take a 15-question run.",
    eyebrow: "Roblox Quizzes",
    icon: "award",
    statNoun: "quizzes published",
    title: "Roblox quizzes to test in-game knowledge"
  },
  checklists: {
    description: "Actionable runbooks for your favorite experiences so you can mark off tasks, rewards, and codes as you play.",
    eyebrow: "Roblox Checklists",
    icon: "check-square",
    statNoun: "checklists published",
    title: "Guided Roblox checklists to track your progress"
  },
  events: {
    description: "Track Roblox event pages with live, upcoming, and past event coverage from Bloxodes.",
    eyebrow: "Roblox Events",
    icon: "calendar",
    statNoun: "event pages",
    title: "Roblox events to follow now and next"
  },
  lists: {
    description: "Scan curated Roblox game rankings and collections, then open the full list when you want the details.",
    eyebrow: "Roblox Lists",
    icon: "list",
    statNoun: "lists published",
    title: "Curated Roblox game lists"
  },
  wiki: {
    description: "Quick database cards for Bloxodes wiki pages, built around games, mechanics, stats, and related resources.",
    eyebrow: "Roblox Wiki",
    icon: "book-open",
    statNoun: "wiki pages",
    title: "Roblox wiki pages and game references"
  }
};

function isMobileContentScreen(name: Screen["name"]): name is MobileContentKind {
  return name in CONTENT_SECTIONS;
}

type AppStyles = ReturnType<typeof createAppStyles>;

type ContentState = {
  data: MobileContentIndexResponse | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
};

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  styles: AppStyles;
  statusBarStyle: "dark" | "light";
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function useAppTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useAppTheme must be used inside ThemeContext.Provider");
  }
  return theme;
}

function formatDate(value: string | null): string {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatUpdatedLabel(value: string | null): string {
  if (!value) return "recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.abs(Math.round(diffMs / 86_400_000));

  if (diffDays <= 4) {
    if (diffDays === 0) return "today";
    if (diffDays === 1) return diffMs >= 0 ? "yesterday" : "tomorrow";
    return diffMs >= 0 ? `${diffDays} days ago` : `in ${diffDays} days`;
  }

  return formatDate(value);
}

function monthYear() {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date());
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

function formatRewardText(value: string | null): string {
  if (!value) return "No reward listed yet.";
  return /this code gives you/i.test(value) ? value : `You get ${value}`;
}

function BrandLogo({ large }: { large?: boolean }) {
  const { isDark, styles } = useAppTheme();
  return (
    <Image
      source={isDark ? LOGO_DARK : LOGO_LIGHT}
      style={large ? styles.logoLarge : styles.logoSmall}
      resizeMode="contain"
      accessibilityLabel="Bloxodes"
    />
  );
}

function AppIcon({
  color,
  name,
  size = 16
}: {
  color?: string;
  name: FeatherIconName;
  size?: number;
}) {
  const { colors } = useAppTheme();
  return <Feather name={name} size={size} color={color ?? colors.mutedStrong} />;
}

function HamburgerIcon() {
  const { colors } = useAppTheme();
  return <AppIcon name="menu" size={20} color={colors.foreground} />;
}

function CloseIcon() {
  const { colors } = useAppTheme();
  return <AppIcon name="x" size={16} color={colors.mutedStrong} />;
}

function SearchIcon() {
  const { colors } = useAppTheme();
  return <AppIcon name="search" size={15} color={colors.muted} />;
}

function getSearchIcon(type: SearchItem["type"]): FeatherIconName {
  switch (type) {
    case "article":
      return "file-text";
    case "catalog":
      return "grid";
    case "checklist":
      return "check-square";
    case "codes":
      return "key";
    case "event":
      return "calendar";
    case "list":
      return "list";
    case "quiz":
      return "award";
    case "tool":
      return "tool";
    case "wiki":
      return "book-open";
    case "author":
      return "user";
    case "music":
      return "music";
    default:
      return "search";
  }
}

function getSearchLabel(type: SearchItem["type"]): string {
  switch (type) {
    case "codes":
      return "Codes";
    case "article":
      return "Article";
    case "checklist":
      return "Checklist";
    case "quiz":
      return "Quiz";
    case "list":
      return "List";
    case "tool":
      return "Tool";
    case "catalog":
      return "Catalog";
    case "event":
      return "Event";
    case "author":
      return "Author";
    case "music":
      return "Music";
    case "wiki":
      return "Wiki";
    default:
      return "Result";
  }
}

function CopyIcon({ copied }: { copied: boolean }) {
  const { colors } = useAppTheme();
  return <AppIcon name={copied ? "check" : "copy"} size={14} color={copied ? colors.white : colors.accent} />;
}

function ThemeIcon() {
  const { colors, isDark } = useAppTheme();
  return <AppIcon name={isDark ? "moon" : "sun"} size={14} color={colors.foreground} />;
}

function AppShell({
  children,
  currentScreen,
  drawerOpen,
  onNavigate,
  onSearchResult,
  onSignIn,
  setDrawerOpen
}: {
  children: JSX.Element;
  currentScreen: Screen;
  drawerOpen: boolean;
  onNavigate: (screen: Screen) => void;
  onSearchResult: (item: SearchItem) => void;
  onSignIn: () => void;
  setDrawerOpen: (open: boolean) => void;
}) {
  const { styles, statusBarStyle } = useAppTheme();
  const { height, width } = useWindowDimensions();
  const sidebarVisible = width >= WEB_BREAKPOINT_XL;

  return (
    <SafeAreaView style={[styles.safeArea, { minHeight: height }]}>
      <StatusBar style={statusBarStyle} />
      <View style={styles.appFrame}>
        {sidebarVisible ? (
          <Sidebar currentScreen={currentScreen} onNavigate={onNavigate} onSearchResult={onSearchResult} onSignIn={onSignIn} />
        ) : null}
        <View style={styles.mainColumn}>
          {!sidebarVisible ? (
            <View style={styles.topBar}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Open navigation"
                onPress={() => setDrawerOpen(true)}
                style={styles.iconButton}
              >
                <HamburgerIcon />
              </TouchableOpacity>
              <BrandLogo />
            </View>
          ) : null}
          {children}
        </View>
      </View>
      {!sidebarVisible && drawerOpen ? (
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={styles.drawerScrim} onPress={() => setDrawerOpen(false)} />
          <View style={styles.drawerPanel}>
            <Sidebar
              currentScreen={currentScreen}
              compact
              onClose={() => setDrawerOpen(false)}
              onNavigate={onNavigate}
              onSearchResult={onSearchResult}
              onSignIn={onSignIn}
            />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Sidebar({
  currentScreen,
  compact,
  onClose,
  onNavigate,
  onSearchResult,
  onSignIn
}: {
  currentScreen: Screen;
  compact?: boolean;
  onClose?: () => void;
  onNavigate: (screen: Screen) => void;
  onSearchResult: (item: SearchItem) => void;
  onSignIn: () => void;
}) {
  const { colors, isDark, styles, toggleTheme } = useAppTheme();
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);

  useEffect(() => {
    const normalized = query.replace(/\s+/g, " ").trim();
    if (normalized.length < 2) {
      setSearchError(null);
      setSearchLoading(false);
      setSearchResults([]);
      return;
    }

    let canceled = false;
    setSearchLoading(true);
    setSearchError(null);

    const timeout = setTimeout(() => {
      fetchSearchResults(normalized)
        .then((response) => {
          if (canceled) return;
          setSearchResults(response.items);
        })
        .catch((error) => {
          if (canceled) return;
          setSearchResults([]);
          setSearchError(error instanceof Error ? error.message : "Search failed");
        })
        .finally(() => {
          if (!canceled) setSearchLoading(false);
        });
    }, 250);

    return () => {
      canceled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  return (
    <View style={[styles.sidebar, compact ? styles.sidebarCompact : null]}>
      <View style={styles.sidebarHeader}>
        <View style={styles.logoCenter}>
          <BrandLogo large />
        </View>
        {compact ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose} style={styles.closeButton}>
            <CloseIcon />
          </TouchableOpacity>
        ) : null}
        <View style={styles.searchBox}>
          <SearchIcon />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search Bloxodes"
            placeholderTextColor={styles.searchPlaceholder.color}
            style={styles.searchInput}
            inputMode="search"
          />
        </View>
        {query.trim().length >= 2 ? (
          <View style={styles.searchResultsPanel}>
            {searchLoading ? <Text style={styles.searchStateText}>Searching</Text> : null}
            {searchError ? <Text style={styles.searchStateText}>{searchError}</Text> : null}
            {!searchLoading && !searchError && searchResults.length === 0 ? <Text style={styles.searchStateText}>No results found</Text> : null}
            {searchResults.slice(0, 8).map((item) => (
              <TouchableOpacity
                key={item.id}
                accessibilityRole="button"
                onPress={() => {
                  onSearchResult(item);
                  setQuery("");
                  onClose?.();
                }}
                style={styles.searchResultItem}
              >
                <View style={styles.searchResultIcon}>
                  <AppIcon name={getSearchIcon(item.type)} size={13} color={colors.muted} />
                </View>
                <View style={styles.searchResultBody}>
                  <Text style={styles.searchResultTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.searchResultMeta} numberOfLines={1}>
                    {item.badge ?? item.subtitle ?? getSearchLabel(item.type)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.navList}>
        <Text style={styles.navGroupLabel}>Browse</Text>
        {NAV_ITEMS.map((item) => {
          const screenName = item.toLowerCase() as Screen["name"];
          const active =
            (item === "Codes" && currentScreen.name.startsWith("code")) ||
            (isMobileContentScreen(currentScreen.name) && screenName === currentScreen.name);
          const iconColor = active ? colors.foreground : colors.muted;
          return (
            <TouchableOpacity
              key={item}
              accessibilityRole="button"
              onPress={() => {
                onNavigate(item === "Codes" ? { name: "codes" } : { name: screenName });
                onClose?.();
              }}
              style={[styles.navItem, active ? styles.navItemActive : null]}
            >
              <View style={styles.navIcon}>
                <AppIcon name={NAV_ITEM_ICONS[item]} size={14} color={iconColor} />
              </View>
              <Text style={[styles.navItemText, active ? styles.navItemTextActive : null]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
        <View style={styles.sidebarSeparator} />
        <TouchableOpacity style={styles.navItem} accessibilityRole="button" onPress={onSignIn}>
          <View style={styles.navIcon}>
            <AppIcon name="user" size={14} color={colors.muted} />
          </View>
          <Text style={styles.navItemText}>Sign in</Text>
        </TouchableOpacity>
        <View style={styles.themeRow}>
          <Text style={styles.themeLabel}>Theme</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onPress={toggleTheme}
            style={styles.themeButton}
          >
            <ThemeIcon />
          </TouchableOpacity>
        </View>
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
  const { colors, styles } = useAppTheme();
  const { width } = useWindowDimensions();
  const refreshedLabel = games[0] ? formatUpdatedLabel(games[0].contentUpdatedAt) : null;
  const cardColumns = width >= WEB_BREAKPOINT_LG ? 4 : width >= WEB_BREAKPOINT_MD ? 3 : 1;
  const mainWidth = width >= WEB_BREAKPOINT_XL ? width - SIDEBAR_WIDTH : width;
  const contentWidth = Math.min(Math.max(mainWidth - CONTENT_PADDING * 2, 0), CONTENT_MAX_WIDTH);
  const cardWidth = (contentWidth - CARD_GAP * (cardColumns - 1)) / cardColumns;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>Roblox Codes Hub</Text>
        <Text style={styles.pageTitle}>Fresh Roblox game codes, updated as soon as they drop</Text>
        <Text style={styles.pageDescription}>
          Find the latest Roblox codes for all your favorite games in one place. Updated daily with active promo codes, rewards, and
          freebies to help you unlock items, boosts, and more.
        </Text>
        <View style={styles.statsRow}>
          <Pill icon="key" label={`${total || games.length} games tracked`} tone="accent" />
          {refreshedLabel ? <Pill icon="clock" label={`Updated ${refreshedLabel}`} /> : null}
        </View>
      </View>

      {error ? <ErrorPanel message={error} onRetry={onRefresh} /> : null}
      {loading && games.length === 0 ? <LoadingPanel label="Loading Bloxodes codes" /> : null}

      <View style={styles.grid}>
        {games.map((game) => (
          <TouchableOpacity key={game.id} style={[styles.gameCard, { width: cardWidth }]} onPress={() => onSelectGame(game.slug)}>
            <View style={styles.gameCardImageWrap}>
              <ImageSlot source={game.coverImage} label={game.name} />
              <View style={styles.imageBottomFade} />
            </View>
            <View style={styles.gameCardBody}>
              <Text style={styles.gameTitle} numberOfLines={2}>
                {game.name} Codes
              </Text>
              <View style={styles.gameMetaRow}>
                <View style={styles.gameMetaItem}>
                  <View style={styles.activeDot} />
                  <Text style={styles.gameMetaText}>
                    {game.activeCount} {game.activeCount === 1 ? "active code" : "active codes"}
                  </Text>
                </View>
                <View style={styles.gameMetaItem}>
                  <AppIcon name="clock" size={12} color={colors.mutedStrong} />
                  <Text style={styles.gameMetaText}>{formatUpdatedLabel(game.contentUpdatedAt)}</Text>
                </View>
              </View>
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

function ContentIndexScreen({
  data,
  error,
  kind,
  loading,
  onLoadMore,
  onRefresh,
  refreshing
}: {
  data: MobileContentIndexResponse | null;
  error: string | null;
  kind: MobileContentKind;
  loading: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { colors, styles } = useAppTheme();
  const { width } = useWindowDimensions();
  const config = CONTENT_SECTIONS[kind];
  const items = data?.items ?? [];
  const cardColumns = width >= WEB_BREAKPOINT_LG ? 4 : width >= WEB_BREAKPOINT_MD ? 3 : 1;
  const mainWidth = width >= WEB_BREAKPOINT_XL ? width - SIDEBAR_WIDTH : width;
  const contentWidth = Math.min(Math.max(mainWidth - CONTENT_PADDING * 2, 0), CONTENT_MAX_WIDTH);
  const cardWidth = (contentWidth - CARD_GAP * (cardColumns - 1)) / cardColumns;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>{config.eyebrow}</Text>
        <Text style={styles.pageTitle}>{config.title}</Text>
        <Text style={styles.pageDescription}>{config.description}</Text>
        <View style={styles.statsRow}>
          <Pill icon={config.icon} label={`${data?.total ?? 0} ${config.statNoun}`} tone="accent" />
          {data?.latestUpdatedAt ? <Pill icon="clock" label={`Updated ${formatUpdatedLabel(data.latestUpdatedAt)}`} /> : null}
        </View>
      </View>

      {error ? <ErrorPanel message={error} onRetry={onRefresh} /> : null}
      {loading && items.length === 0 ? <LoadingPanel label={`Loading Bloxodes ${kind}`} /> : null}

      {!loading && !error && items.length === 0 ? (
        <View style={styles.statePanel}>
          <Text style={styles.errorTitle}>Nothing published yet</Text>
          <Text style={styles.mutedText}>Check back soon for new Bloxodes {kind}.</Text>
        </View>
      ) : null}

      <View style={styles.grid}>
        {items.map((item) => (
          <ContentCard key={item.id} item={item} width={cardWidth} />
        ))}
      </View>

      {data && items.length > 0 && data.page < data.totalPages ? (
        <TouchableOpacity style={styles.loadMoreButton} onPress={onLoadMore} disabled={loading}>
          <Text style={styles.loadMoreText}>{loading ? "Loading" : "Load more"}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

function ContentCard({ item, width }: { item: MobileContentItem; width: number }) {
  const { colors, styles } = useAppTheme();

  return (
    <TouchableOpacity style={[styles.gameCard, { width }]} onPress={() => Linking.openURL(buildWebUrl(item.url))}>
      <View style={styles.gameCardImageWrap}>
        <ImageSlot source={item.coverImage} label={item.title} />
        <View style={styles.imageBottomFade} />
      </View>
      <View style={styles.gameCardBody}>
        <Text style={styles.gameTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.summary ? (
          <Text style={styles.contentCardSummary} numberOfLines={3}>
            {item.summary}
          </Text>
        ) : null}
        <View style={styles.gameMetaRow}>
          {item.badge ? (
            <View style={styles.gameMetaItem}>
              <View style={styles.activeDot} />
              <Text style={styles.gameMetaText}>{item.badge}</Text>
            </View>
          ) : null}
          <View style={styles.gameMetaItem}>
            <AppIcon name="clock" size={12} color={colors.mutedStrong} />
            <Text style={styles.gameMetaText}>{formatUpdatedLabel(item.updatedAt)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
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
  const { styles } = useAppTheme();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  async function copyCode(code: string) {
    await Clipboard.setStringAsync(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {loading ? <LoadingPanel label="Loading Bloxodes codes" /> : null}
      {error ? <ErrorPanel message={error} onRetry={onRetry} /> : null}

      {detail ? (
        <>
          <View style={styles.detailHeader}>
            <View style={styles.breadcrumbRow}>
              <TouchableOpacity onPress={onBack}>
                <Text style={styles.breadcrumbLink}>Codes</Text>
              </TouchableOpacity>
              <Text style={styles.breadcrumbDivider}>&gt;</Text>
              <Text style={styles.breadcrumbCurrent} numberOfLines={1}>{detail.game.name}</Text>
            </View>
            <Text style={styles.detailTitle}>{detail.game.name} Codes ({monthYear()})</Text>
            <View style={styles.updatedLine}>
              <AppIcon name="clock" size={14} color={styles.clockIcon.color} />
              <Text style={styles.updatedText}>
                Updated on <Text style={styles.updatedStrong}>{formatDate(detail.game.contentUpdatedAt)}</Text>
              </Text>
            </View>
            <Text style={styles.detailIntro}>
              {stripMarkdown(detail.game.description) ?? `Get the latest ${detail.game.name} codes and redeem them for free in-game rewards.`}
            </Text>
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

          <ExpiredCodesPanel codes={detail.expiredCodes} gameName={detail.game.name} />

          <View style={styles.externalLinks}>
            <TouchableOpacity style={styles.outlineButton} onPress={() => Linking.openURL(buildWebUrl(detail.game.url))}>
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
  const { styles } = useAppTheme();

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
          codes.map((code, index) => {
            const copied = copiedCode === code.code;
            return (
              <View key={code.id} style={[styles.codeRow, index > 0 ? styles.codeRowBorder : null]}>
                <View style={styles.codeRowMain}>
                  <View style={styles.codeIndex}>
                    <Text style={styles.codeIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.codeMain}>
                    <View style={styles.codeLine}>
                      <Text style={styles.codeText}>{code.code}</Text>
                      {code.isNew ? <Text style={styles.miniBadge}>New</Text> : null}
                      {code.levelRequirement != null ? <Text style={styles.miniBadge}>Level {code.levelRequirement}+</Text> : null}
                    </View>
                    <Text style={styles.mutedText} numberOfLines={2}>{formatRewardText(code.rewardText)}</Text>
                  </View>
                </View>
                <View style={styles.codeActionRow}>
                  <TouchableOpacity style={[styles.copyButton, copied ? styles.copyButtonDone : null]} onPress={() => onCopy(code.code)}>
                    <CopyIcon copied={copied} />
                    <Text style={[styles.copyButtonText, copied ? styles.copyButtonDoneText : null]}>
                      {copied ? "Copied" : "Copy"}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.addedText}>Added {formatDate(code.firstSeenAt)}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

function ExpiredCodesPanel({ codes, gameName }: { codes: CodeItem[]; gameName: string }) {
  const { styles } = useAppTheme();

  return (
    <View style={styles.codesPanel}>
      <View style={styles.codesPanelHeader}>
        <View style={styles.panelHeading}>
          <Text style={styles.panelTitle}>Expired {gameName} Codes</Text>
          {codes.length > 0 ? <Text style={styles.panelSubtitle}>These codes are expired and no longer work.</Text> : null}
        </View>
        <Text style={styles.outlineBadge}>{codes.length} expired</Text>
      </View>
      <View style={styles.expiredContent}>
        {codes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.mutedText}>We haven't tracked any expired codes yet.</Text>
          </View>
        ) : (
          <View style={styles.expiredChipList}>
            {codes.map((code) => (
              <View key={code.id} style={styles.expiredChip}>
                <Text style={styles.expiredChipText}>{code.code}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function ImageSlot({ source, label, tall }: { source: string | null; label: string; tall?: boolean }) {
  const { styles } = useAppTheme();

  if (!source) {
    return (
      <View style={[styles.imageFallback, tall ? styles.imageTall : null]}>
        <Text style={styles.imageFallbackText}>{label.slice(0, 1).toUpperCase()}</Text>
      </View>
    );
  }

  return <Image source={{ uri: source }} style={[styles.image, tall ? styles.imageTall : null]} resizeMode="cover" />;
}

function Pill({ icon, label, tone }: { icon?: FeatherIconName; label: string; tone?: "accent" | "muted" }) {
  const { colors, styles } = useAppTheme();
  const iconColor = tone === "accent" ? colors.accent : colors.muted;

  return (
    <View style={[styles.pill, tone === "accent" ? styles.pillAccent : null]}>
      {icon ? <AppIcon name={icon} size={14} color={iconColor} /> : null}
      <Text style={[styles.pillText, tone === "accent" ? styles.pillTextAccent : null]}>{label}</Text>
    </View>
  );
}

function LoadingPanel({ label }: { label: string }) {
  const { colors, styles } = useAppTheme();

  return (
    <View style={styles.statePanel}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { styles } = useAppTheme();

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
  const colorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<"light" | "dark" | null>(null);
  const isDark = themeMode ? themeMode === "dark" : colorScheme === "dark";
  const theme = useMemo<ThemeContextValue>(() => {
    const themeColors = isDark ? darkColors : lightColors;
    return {
      colors: themeColors,
      isDark,
      styles: createAppStyles(themeColors),
      statusBarStyle: isDark ? "light" : "dark",
      toggleTheme: () => setThemeMode(isDark ? "light" : "dark")
    };
  }, [isDark]);
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
  const [contentSections, setContentSections] = useState<Record<MobileContentKind, ContentState>>({
    articles: { data: null, error: null, loading: false, refreshing: false },
    catalog: { data: null, error: null, loading: false, refreshing: false },
    checklists: { data: null, error: null, loading: false, refreshing: false },
    events: { data: null, error: null, loading: false, refreshing: false },
    lists: { data: null, error: null, loading: false, refreshing: false },
    quizzes: { data: null, error: null, loading: false, refreshing: false },
    tools: { data: null, error: null, loading: false, refreshing: false },
    wiki: { data: null, error: null, loading: false, refreshing: false }
  });

  const currentSlug = screen.name === "codeDetail" ? screen.slug : undefined;
  const currentContentKind = isMobileContentScreen(screen.name) ? screen.name : null;

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

  async function loadContent(kind: MobileContentKind, nextPage = 1, replace = true) {
    setContentSections((prev) => ({
      ...prev,
      [kind]: {
        ...prev[kind],
        error: null,
        loading: true
      }
    }));

    try {
      const response = await fetchContentIndex(kind, nextPage);
      setContentSections((prev) => ({
        ...prev,
        [kind]: {
          data: replace || !prev[kind].data
            ? response
            : {
                ...response,
                items: [...prev[kind].data.items, ...response.items]
              },
          error: null,
          loading: false,
          refreshing: false
        }
      }));
    } catch (error) {
      setContentSections((prev) => ({
        ...prev,
        [kind]: {
          ...prev[kind],
          error: error instanceof Error ? error.message : `Failed to load ${kind}`,
          loading: false,
          refreshing: false
        }
      }));
    }
  }

  async function refreshContent(kind: MobileContentKind) {
    setContentSections((prev) => ({
      ...prev,
      [kind]: {
        ...prev[kind],
        refreshing: true
      }
    }));
    await loadContent(kind, 1, true);
  }

  function openWebUrl(url: string) {
    void Linking.openURL(buildWebUrl(url));
  }

  function handleSearchResult(item: SearchItem) {
    let pathname = item.url;
    try {
      pathname = new URL(buildWebUrl(item.url)).pathname;
    } catch {
      pathname = item.url;
    }

    const codeMatch = pathname.match(/^\/codes\/([^/]+)\/?$/);
    if (item.type === "codes" && codeMatch?.[1]) {
      setScreen({ name: "codeDetail", slug: decodeURIComponent(codeMatch[1]) });
      return;
    }

    openWebUrl(item.url);
  }

  function handleSignIn() {
    openWebUrl(`/auth/roblox/login?next=${encodeURIComponent("/account")}`);
  }

  useEffect(() => {
    void loadIndex(1, true);
  }, []);

  useEffect(() => {
    if (currentSlug) {
      void loadDetail(currentSlug);
    }
  }, [currentSlug]);

  useEffect(() => {
    if (currentContentKind && !contentSections[currentContentKind].data && !contentSections[currentContentKind].loading) {
      void loadContent(currentContentKind, 1, true);
    }
  }, [currentContentKind, contentSections]);

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

    if (isMobileContentScreen(screen.name)) {
      const section = contentSections[screen.name];
      const nextPage = (section.data?.page ?? 0) + 1;
      return (
        <ContentIndexScreen
          data={section.data}
          error={section.error}
          kind={screen.name}
          loading={section.loading}
          refreshing={section.refreshing}
          onRefresh={() => void refreshContent(screen.name as MobileContentKind)}
          onLoadMore={() => void loadContent(screen.name as MobileContentKind, nextPage, false)}
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
  }, [contentSections, currentSlug, detail, detailError, detailLoading, games, indexError, indexLoading, page, refreshing, screen.name, total, totalPages]);

  return (
    <ThemeContext.Provider value={theme}>
      <AppShell
        currentScreen={screen}
        drawerOpen={drawerOpen}
        onNavigate={setScreen}
        onSearchResult={handleSearchResult}
        onSignIn={handleSignIn}
        setDrawerOpen={setDrawerOpen}
      >
        {content}
      </AppShell>
    </ThemeContext.Provider>
  );
}

function createAppStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: 12,
    paddingBottom: spacing.md
  },
  sidebarCompact: {
    width: 300,
    height: "100%"
  },
  sidebarHeader: {
    paddingBottom: spacing.sm,
    paddingTop: 20
  },
  logoCenter: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center"
  },
  logoSmall: {
    width: 104,
    height: 35
  },
  logoLarge: {
    width: 144,
    height: 48
  },
  closeButton: {
    position: "absolute",
    right: 0,
    top: 24,
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center"
  },
  searchBox: {
    height: 32,
    marginTop: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "500",
    paddingHorizontal: spacing.sm,
    paddingVertical: 0
  },
  searchPlaceholder: {
    color: colors.muted
  },
  searchResultsPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    gap: 2,
    marginTop: spacing.sm,
    overflow: "hidden",
    padding: spacing.xs
  },
  searchStateText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  searchResultItem: {
    borderRadius: radii.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  searchResultIcon: {
    width: 22,
    alignItems: "center"
  },
  searchResultBody: {
    flex: 1,
    minWidth: 0
  },
  searchResultTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "700"
  },
  searchResultMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2
  },
  navList: {
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm
  },
  navGroupLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    textTransform: "uppercase"
  },
  navItem: {
    minHeight: 32,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  navItemActive: {
    backgroundColor: colors.surfaceMuted
  },
  navItemDisabled: {
    opacity: 0.62
  },
  navIcon: {
    width: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  navItemText: {
    color: colors.mutedStrong,
    flex: 1,
    fontSize: 13,
    fontWeight: "600"
  },
  navItemTextActive: {
    color: colors.foreground
  },
  sidebarSeparator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
    marginVertical: spacing.sm
  },
  themeRow: {
    minHeight: 32,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  themeLabel: {
    color: colors.mutedStrong,
    fontSize: 13,
    fontWeight: "600"
  },
  themeButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  themeIcon: {
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 18
  },
  mainColumn: {
    flex: 1
  },
  topBar: {
    height: 65,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center"
  },
  hamburgerIcon: {
    width: 20,
    gap: 4
  },
  hamburgerLine: {
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.foreground
  },
  closeIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  closeLine: {
    position: "absolute",
    width: 16,
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.mutedStrong
  },
  closeLineLeft: {
    transform: [{ rotate: "45deg" }]
  },
  closeLineRight: {
    transform: [{ rotate: "-45deg" }]
  },
  searchIcon: {
    width: 16,
    height: 16
  },
  searchCircle: {
    width: 11,
    height: 11,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.muted,
    left: 1,
    top: 1
  },
  searchHandle: {
    position: "absolute",
    width: 7,
    height: 1.5,
    borderRadius: 999,
    backgroundColor: colors.muted,
    bottom: 2,
    right: 0,
    transform: [{ rotate: "45deg" }]
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
    backgroundColor: colors.scrim
  },
  drawerPanel: {
    height: "100%"
  },
  content: {
    padding: CONTENT_PADDING,
    gap: 40,
    paddingBottom: 48,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center"
  },
  headerBlock: {
    gap: spacing.md,
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
    fontSize: 36,
    lineHeight: 43,
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
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: "center"
  },
  pillAccent: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft
  },
  pillText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600"
  },
  pillTextAccent: {
    color: colors.accent
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20
  },
  gameCard: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  gameCardImageWrap: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted
  },
  imageBottomFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
    backgroundColor: colors.surface
  },
  image: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceMuted
  },
  imageTall: {
    height: 210
  },
  imageFallback: {
    width: "100%",
    aspectRatio: 16 / 9,
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
    marginTop: -4,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface
  },
  gameTitle: {
    color: colors.foreground,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700"
  },
  gameMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  gameMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#4ade80"
  },
  gameMetaText: {
    color: colors.mutedStrong,
    fontSize: 12,
    fontWeight: "500"
  },
  contentCardSummary: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
  },
  clockIcon: {
    color: colors.mutedStrong,
    fontSize: 13,
    fontWeight: "700"
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
    borderColor: colors.accentBorder,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
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
  detailHeader: {
    gap: spacing.md
  },
  breadcrumbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  breadcrumbLink: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  breadcrumbDivider: {
    color: colors.muted,
    fontSize: 12
  },
  breadcrumbCurrent: {
    color: colors.foreground,
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  detailTitle: {
    color: colors.foreground,
    fontSize: 38,
    lineHeight: 46,
    fontWeight: "800"
  },
  updatedLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  updatedText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  updatedStrong: {
    color: colors.foreground,
    fontWeight: "700"
  },
  detailIntro: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 25
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
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
  outlineBadge: {
    overflow: "hidden",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  codesList: {
    overflow: "hidden",
    margin: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm
  },
  codeRow: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  codeRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  codeIndex: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
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
    minWidth: 0,
    gap: 6
  },
  codeRowMain: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start"
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
    backgroundColor: colors.accentSoft,
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
  codeActionRow: {
    paddingLeft: 40,
    gap: spacing.sm,
    alignItems: "flex-start"
  },
  copyButton: {
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
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
  copyIcon: {
    width: 14,
    height: 14
  },
  copyBack: {
    position: "absolute",
    left: 1,
    top: 1,
    width: 9,
    height: 9,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.accent
  },
  copyFront: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 9,
    height: 9,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  checkIcon: {
    width: 14,
    height: 14
  },
  checkShort: {
    position: "absolute",
    left: 2,
    top: 7,
    width: 5,
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.white,
    transform: [{ rotate: "45deg" }]
  },
  checkLong: {
    position: "absolute",
    left: 5,
    top: 6,
    width: 9,
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.white,
    transform: [{ rotate: "-45deg" }]
  },
  emptyState: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700"
  },
  expiredContent: {
    padding: spacing.md
  },
  expiredChipList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  expiredChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  expiredChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600"
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
    borderColor: colors.accentBorder,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  retryButtonText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800"
  }
  });
}
