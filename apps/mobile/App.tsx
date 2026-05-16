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
import {
  buildWebUrl,
  fetchCodeDetail,
  fetchCodeProgress,
  fetchCodesIndex,
  fetchCodeSession,
  saveCodeProgress
} from "./src/api";
import { darkColors, lightColors, radii, spacing, type ThemeColors } from "./src/theme";
import type { CodeDetailResponse, CodeItem, CodesIndexItem } from "./src/types";

const LOGO_LIGHT = require("./assets/Bloxodes-light.png");
const LOGO_DARK = require("./assets/Bloxodes-dark.png");

const WEB_BREAKPOINT_MD = 768;
const WEB_BREAKPOINT_LG = 1024;
const CONTENT_MAX_WIDTH = 920;
const PAGE_SIZE = 24;

type FeatherIconName = keyof typeof Feather.glyphMap;

type Screen =
  | { name: "codes" }
  | { name: "detail"; slug: string }
  | { name: "account" };

type AppStyles = ReturnType<typeof createAppStyles>;

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
  if (!theme) throw new Error("useAppTheme must be used inside ThemeContext.Provider");
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
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.abs(Math.round(diffMs / 86_400_000));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return diffMs >= 0 ? "yesterday" : "tomorrow";
  if (diffDays <= 7) return diffMs >= 0 ? `${diffDays} days ago` : `in ${diffDays} days`;
  return formatDate(value);
}

function formatRefreshedLabel(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absMs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (absMs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  if (absMs < month) return rtf.format(Math.round(diffMs / day), "day");
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

function rewardText(value: string | null): string {
  if (!value) return "No reward listed yet.";
  return /this code gives you/i.test(value) ? value : `You get ${value}`;
}

function normalizeUsedCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function storageGet(key: string): string | null {
  try {
    const storage = (globalThis as { localStorage?: { getItem: (key: string) => string | null } }).localStorage;
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    const storage = (globalThis as { localStorage?: { setItem: (key: string, value: string) => void } }).localStorage;
    storage?.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

function progressKey(slug: string) {
  return `code-progress:${slug.trim().toLowerCase()}`;
}

function legacyProgressKey(gameName: string) {
  const slug = gameName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "default";
  return `roblox-codes-checked-${slug}`;
}

function readLocalProgress(slug: string, gameName: string): string[] {
  for (const key of [progressKey(slug), legacyProgressKey(gameName)]) {
    const raw = storageGet(key);
    if (!raw) continue;
    try {
      return normalizeUsedCodes(JSON.parse(raw));
    } catch {
      // ignore invalid storage payloads
    }
  }
  return [];
}

function writeLocalProgress(slug: string, gameName: string, usedCodes: string[]) {
  const serialized = JSON.stringify(normalizeUsedCodes(usedCodes));
  storageSet(progressKey(slug), serialized);
  storageSet(legacyProgressKey(gameName), serialized);
}

function AppIcon({ color, name, size = 18 }: { color: string; name: FeatherIconName; size?: number }) {
  return <Feather name={name} size={size} color={color} />;
}

function AppLogo({ large = false }: { large?: boolean }) {
  const { isDark, styles } = useAppTheme();
  return (
    <Image
      source={isDark ? LOGO_DARK : LOGO_LIGHT}
      resizeMode="contain"
      style={large ? styles.logoLarge : styles.logoSmall}
      accessibilityLabel="Bloxodes"
    />
  );
}

function ImageSlot({ source, label }: { source: string | null; label: string }) {
  const { styles } = useAppTheme();
  if (!source) {
    return (
      <View style={styles.imageFallback}>
        <Text style={styles.imageFallbackText}>{label.slice(0, 1).toUpperCase()}</Text>
      </View>
    );
  }
  return <Image source={{ uri: source }} style={styles.image} resizeMode="cover" />;
}

function Pill({ icon, label, tone = "default" }: { icon: FeatherIconName; label: string; tone?: "default" | "accent" | "success" }) {
  const { colors, styles } = useAppTheme();
  return (
    <View style={[styles.pill, tone === "accent" ? styles.pillAccent : null, tone === "success" ? styles.pillSuccess : null]}>
      <AppIcon name={icon} size={13} color={tone === "default" ? colors.mutedStrong : colors.accent} />
      <Text style={[styles.pillText, tone !== "default" ? styles.pillTextAccent : null]}>{label}</Text>
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
      <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.82}>
        <Text style={styles.retryButtonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

function Shell({
  children,
  currentScreen,
  onNavigate,
  onSignIn,
  userId
}: {
  children: React.ReactNode;
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onSignIn: () => void;
  userId: string | null;
}) {
  const { colors, styles, statusBarStyle, toggleTheme, isDark } = useAppTheme();
  const { height } = useWindowDimensions();
  return (
    <SafeAreaView style={[styles.safeArea, { minHeight: height }]}>
      <StatusBar style={statusBarStyle} />
      <View style={styles.appFrame}>
        <View style={styles.topBar}>
          <AppLogo />
          <View style={styles.topBarActions}>
            <TouchableOpacity style={styles.iconButton} onPress={toggleTheme} activeOpacity={0.82}>
              <AppIcon name={isDark ? "sun" : "moon"} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.accountButton} onPress={() => (userId ? onNavigate({ name: "account" }) : onSignIn())} activeOpacity={0.82}>
              <AppIcon name={userId ? "user-check" : "user"} color={userId ? colors.accent : colors.foreground} size={16} />
              <Text style={styles.accountButtonText}>{userId ? "Account" : "Sign in"}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.contentFrame}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

function CodesIndexScreen({
  error,
  games,
  loading,
  onOpenGame,
  onPageChange,
  onRefresh,
  onSearch,
  page,
  query,
  refreshing,
  total,
  totalPages
}: {
  error: string | null;
  games: CodesIndexItem[];
  loading: boolean;
  onOpenGame: (slug: string) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onSearch: (query: string) => void;
  page: number;
  query: string;
  refreshing: boolean;
  total: number;
  totalPages: number;
}) {
  const { colors, styles } = useAppTheme();
  const { width } = useWindowDimensions();
  const [searchText, setSearchText] = useState(query);
  const columns = width >= WEB_BREAKPOINT_LG ? 4 : width >= WEB_BREAKPOINT_MD ? 3 : 1;
  const cardGap = 16;
  const contentWidth = Math.min(width - spacing.lg * 2, CONTENT_MAX_WIDTH);
  const cardWidth = (contentWidth - cardGap * (columns - 1)) / columns;
  const refreshedLabel = formatRefreshedLabel(games[0]?.contentUpdatedAt ?? games[0]?.latestCodeFirstSeenAt ?? null);

  useEffect(() => {
    setSearchText(query);
  }, [query]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Roblox Codes Hub</Text>
        <Text style={styles.pageTitle}>Find active Roblox codes and copy them fast.</Text>
        <Text style={styles.pageDescription}>
          A focused Bloxodes app for browsing current game code pages with the same database-first feel as the website.
        </Text>
        <View style={styles.statsRow}>
          <Pill icon="key" label={`${total || games.length} games tracked`} tone="accent" />
          {refreshedLabel ? <Pill icon="clock" label={`Updated ${refreshedLabel}`} /> : null}
          {query ? <Pill icon="search" label={`Search: ${query}`} /> : null}
        </View>
      </View>

      <View style={styles.searchPanel}>
        <View style={styles.searchInputWrap}>
          <AppIcon name="search" color={colors.muted} size={16} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => onSearch(searchText)}
            placeholder="Search games"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            inputMode="search"
          />
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={() => onSearch(searchText)} activeOpacity={0.82}>
          <Text style={styles.primaryButtonText}>Search</Text>
        </TouchableOpacity>
        {query ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => onSearch("")} activeOpacity={0.82}>
            <Text style={styles.secondaryButtonText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <ErrorPanel message={error} onRetry={onRefresh} /> : null}
      {loading && !games.length ? <LoadingPanel label="Loading code pages" /> : null}

      {games.length ? (
        <View style={styles.indexMetaRow}>
          <Text style={styles.indexMetaText}>Showing {games.length} of {total} games</Text>
          <Text style={styles.indexMetaText}>Page {page} of {totalPages}</Text>
        </View>
      ) : null}

      <View style={styles.grid}>
        {games.map((game) => (
          <TouchableOpacity key={game.id} style={[styles.gameCard, { width: cardWidth }]} onPress={() => onOpenGame(game.slug)} activeOpacity={0.86}>
            <View style={styles.gameImageWrap}>
              <ImageSlot source={game.coverImage} label={game.name} />
              <View style={styles.imageFade} />
            </View>
            <View style={styles.gameCardBody}>
              {game.genre ? <Text style={styles.cardEyebrow} numberOfLines={1}>{game.genre}</Text> : null}
              <Text style={styles.gameTitle} numberOfLines={2}>{game.name} Codes</Text>
              <View style={styles.gameMetaRow}>
                <View style={styles.gameMetaItem}>
                  <View style={styles.activeDot} />
                  <Text style={styles.gameMetaText}>{game.activeCount} active</Text>
                </View>
                <View style={styles.gameMetaItem}>
                  <AppIcon name="clock" color={colors.mutedStrong} size={12} />
                  <Text style={styles.gameMetaText}>{formatUpdatedLabel(game.contentUpdatedAt)}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {games.length && totalPages > 1 ? (
        <Pager page={page} totalPages={totalPages} loading={loading} onPageChange={onPageChange} />
      ) : null}
    </ScrollView>
  );
}

function Pager({
  loading,
  onPageChange,
  page,
  totalPages
}: {
  loading: boolean;
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  const { styles } = useAppTheme();
  return (
    <View style={styles.pager}>
      <TouchableOpacity
        style={[styles.pagerButton, page <= 1 ? styles.pagerButtonDisabled : null]}
        disabled={page <= 1 || loading}
        onPress={() => onPageChange(Math.max(1, page - 1))}
        activeOpacity={0.82}
      >
        <Text style={styles.pagerButtonText}>Previous</Text>
      </TouchableOpacity>
      <Text style={styles.pagerMeta}>Page {page} of {totalPages}</Text>
      <TouchableOpacity
        style={[styles.pagerButton, page >= totalPages ? styles.pagerButtonDisabled : null]}
        disabled={page >= totalPages || loading}
        onPress={() => onPageChange(Math.min(totalPages, page + 1))}
        activeOpacity={0.82}
      >
        <Text style={styles.pagerButtonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
}

function CodeDetailScreen({
  detail,
  error,
  loading,
  onBack,
  onRetry,
  sessionUserId
}: {
  detail: CodeDetailResponse | null;
  error: string | null;
  loading: boolean;
  onBack: () => void;
  onRetry: () => void;
  sessionUserId: string | null;
}) {
  const { colors, styles } = useAppTheme();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [progressReady, setProgressReady] = useState(false);
  const [, setSyncState] = useState<"local" | "syncing" | "synced" | "failed">("local");
  const [usedCodes, setUsedCodes] = useState<Set<string>>(() => new Set());

  const game = detail?.game ?? null;

  useEffect(() => {
    if (!game) return;
    const currentGame = game;
    let cancelled = false;
    async function loadProgress() {
      setProgressReady(false);
      setSyncState(sessionUserId ? "syncing" : "local");
      const local = readLocalProgress(currentGame.slug, currentGame.name);
      if (!sessionUserId) {
        if (!cancelled) {
          setUsedCodes(new Set(local));
          setProgressReady(true);
          setSyncState("local");
        }
        return;
      }
      const account = await fetchCodeProgress(currentGame.slug);
      if (cancelled) return;
      const merged = Array.from(new Set([...account.usedCodes, ...local]));
      setUsedCodes(new Set(merged));
      writeLocalProgress(currentGame.slug, currentGame.name, merged);
      setProgressReady(true);
      setSyncState("synced");
    }
    void loadProgress();
    return () => {
      cancelled = true;
    };
  }, [game?.slug, game?.name, sessionUserId]);

  useEffect(() => {
    if (!game || !progressReady) return;
    const serialized = Array.from(usedCodes);
    writeLocalProgress(game.slug, game.name, serialized);
    if (!sessionUserId) {
      setSyncState("local");
      return;
    }
    setSyncState("syncing");
    const handle = setTimeout(() => {
      void saveCodeProgress(game.slug, serialized).then((ok) => setSyncState(ok ? "synced" : "failed"));
    }, 300);
    return () => clearTimeout(handle);
  }, [game?.slug, game?.name, progressReady, sessionUserId, usedCodes]);

  async function copyCode(code: string) {
    await Clipboard.setStringAsync(code);
    setCopiedCode(code);
    markUsed(code);
    setTimeout(() => setCopiedCode(null), 1600);
  }

  function markUsed(code: string) {
    setUsedCodes((prev) => {
      if (prev.has(code)) return prev;
      const next = new Set(prev);
      next.add(code);
      return next;
    });
  }

  function markUnused(code: string) {
    setUsedCodes((prev) => {
      if (!prev.has(code)) return prev;
      const next = new Set(prev);
      next.delete(code);
      return next;
    });
  }

  const activeCodes = detail?.activeCodes ?? [];
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.82}>
        <AppIcon name="chevron-left" color={colors.foreground} size={16} />
        <Text style={styles.backButtonText}>All codes</Text>
      </TouchableOpacity>

      {loading ? <LoadingPanel label="Loading codes" /> : null}
      {error ? <ErrorPanel message={error} onRetry={onRetry} /> : null}

      {detail ? (
        <>
          <View style={styles.detailHero}>
            <ImageSlot source={detail.game.coverImage} label={detail.game.name} />
            <View style={styles.heroScrim} />
            <View style={styles.detailHeroText}>
              <Text style={styles.heroEyebrow}>Bloxodes Codes</Text>
              <Text style={styles.detailTitle}>{detail.game.name} Codes ({monthYear()})</Text>
              <View style={styles.detailHeroMeta}>
                <Text style={styles.heroBadge}>{detail.activeCodes.length} active</Text>
                <Text style={styles.heroMeta}>Updated {formatDate(detail.game.contentUpdatedAt)}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.detailIntro}>
            {stripMarkdown(detail.game.description) ?? `Track active ${detail.game.name} codes and mark the ones you have already used.`}
          </Text>

          <CodesPanel
            codes={activeCodes}
            copiedCode={copiedCode}
            emptyBody="We have not confirmed any working codes at the moment. Check back soon for the next drop."
            emptyTitle="No active codes right now"
            onCopy={copyCode}
            onMarkUnused={markUnused}
            title={`Active ${detail.game.name} Codes`}
            usedCodes={usedCodes}
          />

          <ExpiredCodesPanel codes={detail.expiredCodes} gameName={detail.game.name} />

          {detail.game.robloxUrl ? (
            <TouchableOpacity style={styles.robloxButton} onPress={() => Linking.openURL(detail.game.robloxUrl!)} activeOpacity={0.82}>
              <AppIcon name="external-link" color={colors.accent} size={15} />
              <Text style={styles.robloxButtonText}>Open Roblox game</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function CodesPanel({
  codes,
  copiedCode,
  emptyBody,
  emptyTitle,
  onCopy,
  onMarkUnused,
  title,
  usedCodes
}: {
  codes: CodeItem[];
  copiedCode: string | null;
  emptyBody: string;
  emptyTitle: string;
  onCopy: (code: string) => void;
  onMarkUnused: (code: string) => void;
  title: string;
  usedCodes: Set<string>;
}) {
  const { colors, styles } = useAppTheme();
  return (
    <View style={styles.codesPanel}>
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.panelTitle}>{title}</Text>
          <Text style={styles.panelSubtitle}>Checked and verified for the current update.</Text>
        </View>
        <Text style={styles.countBadge}>{codes.length} active</Text>
      </View>

      {codes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.mutedText}>{emptyBody}</Text>
        </View>
      ) : (
        <View style={styles.codeList}>
          {codes.map((code, index) => {
            const used = usedCodes.has(code.code);
            const copied = copiedCode === code.code;
            return (
              <View key={code.id} style={[styles.codeRow, index > 0 ? styles.rowBorder : null, used ? styles.codeRowUsed : null]}>
                <View style={styles.codeNumber}>
                  <Text style={styles.codeNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.codeBody}>
                  <View style={styles.codeLine}>
                    <Text style={[styles.codeText, used ? styles.codeTextUsed : null]}>{code.code}</Text>
                    {code.isNew ? <Text style={styles.miniBadge}>New</Text> : null}
                    {code.levelRequirement != null ? <Text style={styles.miniBadge}>Level {code.levelRequirement}+</Text> : null}
                  </View>
                  <Text style={[styles.mutedText, used ? styles.usedMutedText : null]} numberOfLines={2}>{rewardText(code.rewardText)}</Text>
                  <Text style={styles.addedText}>Added {formatDate(code.firstSeenAt)}</Text>
                </View>
                <View style={styles.codeActions}>
                  {used ? (
                    <TouchableOpacity
                      accessibilityLabel={`Uncheck code ${code.code}`}
                      style={styles.uncheckButton}
                      onPress={() => onMarkUnused(code.code)}
                      activeOpacity={0.82}
                    >
                      <AppIcon name="rotate-ccw" color={colors.mutedStrong} size={14} />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={[styles.copyButton, copied ? styles.copyButtonDone : null]} onPress={() => onCopy(code.code)} activeOpacity={0.82}>
                    <AppIcon name={copied ? "check" : "copy"} color={copied ? colors.white : colors.accent} size={14} />
                    <Text style={[styles.copyButtonText, copied ? styles.copyButtonDoneText : null]}>{copied ? "Copied" : "Copy"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function ExpiredCodesPanel({ codes, gameName }: { codes: CodeItem[]; gameName: string }) {
  const { styles } = useAppTheme();
  return (
    <View style={styles.codesPanel}>
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.panelTitle}>Expired {gameName} Codes</Text>
          <Text style={styles.panelSubtitle}>These no longer work, but they help avoid retrying old codes.</Text>
        </View>
        <Text style={styles.outlineBadge}>{codes.length} expired</Text>
      </View>
      {codes.length ? (
        <View style={styles.expiredChipList}>
          {codes.slice(0, 80).map((code) => (
            <View key={code.id} style={styles.expiredChip}>
              <Text style={styles.expiredChipText}>{code.code}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.mutedText}>No expired codes tracked yet.</Text>
        </View>
      )}
    </View>
  );
}

function AccountScreen({
  onRefreshSession,
  onSignIn,
  sessionLoading,
  userId
}: {
  onRefreshSession: () => void;
  onSignIn: () => void;
  sessionLoading: boolean;
  userId: string | null;
}) {
  const { colors, styles } = useAppTheme();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Account Sync</Text>
        <Text style={styles.pageTitle}>Keep copied codes synced with Bloxodes.</Text>
        <Text style={styles.pageDescription}>
          Used-code progress works locally first. Sign in to sync checked codes with your Bloxodes web account where cookies/session are available.
        </Text>
      </View>
      <View style={styles.accountCard}>
        <View style={styles.accountIcon}>
          <AppIcon name={userId ? "user-check" : "user"} color={colors.accent} size={24} />
        </View>
        <Text style={styles.accountTitle}>{userId ? "Signed in" : "Not signed in"}</Text>
        <Text style={styles.mutedText}>
          {userId
            ? "Your checked codes will be merged with local progress and saved to your account."
            : "You can still mark used codes on this device. Sign in when you want sync across web and app."}
        </Text>
        <View style={styles.accountActions}>
          <TouchableOpacity style={styles.primaryButton} onPress={userId ? onRefreshSession : onSignIn} activeOpacity={0.82}>
            <Text style={styles.primaryButtonText}>{sessionLoading ? "Checking" : userId ? "Refresh session" : "Sign in"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
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
  const [games, setGames] = useState<CodesIndexItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [indexLoading, setIndexLoading] = useState(true);
  const [indexRefreshing, setIndexRefreshing] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CodeDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  async function loadIndex(nextPage = 1, nextQuery = query) {
    setIndexLoading(true);
    setIndexError(null);
    try {
      const response = await fetchCodesIndex(nextPage, PAGE_SIZE, nextQuery);
      setGames(response.games);
      setPage(response.page);
      setTotal(response.total);
      setTotalPages(response.totalPages);
      setQuery(nextQuery);
    } catch (error) {
      setIndexError(error instanceof Error ? error.message : "Failed to load codes");
    } finally {
      setIndexLoading(false);
      setIndexRefreshing(false);
    }
  }

  async function refreshIndex() {
    setIndexRefreshing(true);
    await loadIndex(1, query);
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

  async function refreshSession() {
    setSessionLoading(true);
    try {
      const session = await fetchCodeSession();
      setSessionUserId(session.userId);
    } finally {
      setSessionLoading(false);
    }
  }

  function signIn() {
    void Linking.openURL(buildWebUrl(`/auth/roblox/login?next=${encodeURIComponent("/codes")}`));
  }

  useEffect(() => {
    void loadIndex(1, "");
    void refreshSession();
  }, []);

  useEffect(() => {
    if (screen.name === "detail") {
      void loadDetail(screen.slug);
    }
  }, [screen]);

  const content = screen.name === "detail" ? (
    <CodeDetailScreen
      detail={detail}
      error={detailError}
      loading={detailLoading}
      onBack={() => setScreen({ name: "codes" })}
      onRetry={() => screen.name === "detail" && void loadDetail(screen.slug)}
      sessionUserId={sessionUserId}
    />
  ) : screen.name === "account" ? (
    <AccountScreen
      onRefreshSession={() => void refreshSession()}
      onSignIn={signIn}
      sessionLoading={sessionLoading}
      userId={sessionUserId}
    />
  ) : (
    <CodesIndexScreen
      error={indexError}
      games={games}
      loading={indexLoading}
      onOpenGame={(slug) => setScreen({ name: "detail", slug })}
      onPageChange={(pageNumber) => void loadIndex(pageNumber, query)}
      onRefresh={() => void refreshIndex()}
      onSearch={(nextQuery) => void loadIndex(1, nextQuery.trim())}
      page={page}
      query={query}
      refreshing={indexRefreshing}
      total={total}
      totalPages={totalPages}
    />
  );

  return (
    <ThemeContext.Provider value={theme}>
      <Shell currentScreen={screen} onNavigate={setScreen} onSignIn={signIn} userId={sessionUserId}>
        {content}
      </Shell>
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
      backgroundColor: colors.background
    },
    topBar: {
      height: 64,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md
    },
    topBarActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm
    },
    logoSmall: {
      width: 112,
      height: 38
    },
    logoLarge: {
      width: 142,
      height: 48
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface
    },
    accountButton: {
      minHeight: 40,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md
    },
    accountButtonText: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: "800"
    },
    contentFrame: {
      flex: 1
    },
    content: {
      width: "100%",
      maxWidth: CONTENT_MAX_WIDTH,
      alignSelf: "center",
      gap: spacing.xl,
      padding: spacing.lg,
      paddingBottom: spacing.xl
    },
    hero: {
      gap: spacing.md,
      paddingTop: spacing.sm
    },
    heroEyebrow: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "900",
      textTransform: "uppercase"
    },
    pageTitle: {
      color: colors.foreground,
      fontSize: 34,
      lineHeight: 40,
      fontWeight: "800"
    },
    pageDescription: {
      color: colors.muted,
      fontSize: 16,
      lineHeight: 24
    },
    statsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm
    },
    pill: {
      minHeight: 32,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm
    },
    pillAccent: {
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft
    },
    pillSuccess: {
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft
    },
    pillText: {
      color: colors.mutedStrong,
      fontSize: 13,
      fontWeight: "800"
    },
    pillTextAccent: {
      color: colors.accent
    },
    searchPanel: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      alignItems: "center"
    },
    searchInputWrap: {
      flex: 1,
      minWidth: 220,
      minHeight: 42,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceMuted,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      color: colors.foreground,
      fontSize: 15,
      fontWeight: "700",
      paddingVertical: spacing.sm
    },
    primaryButton: {
      minHeight: 42,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg
    },
    primaryButtonText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "900"
    },
    secondaryButton: {
      minHeight: 42,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg
    },
    secondaryButtonText: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: "900"
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 16
    },
    indexMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: spacing.md
    },
    indexMetaText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "800"
    },
    gameCard: {
      overflow: "hidden",
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface
    },
    gameImageWrap: {
      position: "relative",
      overflow: "hidden",
      backgroundColor: colors.surfaceMuted
    },
    image: {
      width: "100%",
      aspectRatio: 16 / 9,
      backgroundColor: colors.surfaceMuted
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
      fontSize: 38,
      fontWeight: "900"
    },
    imageFade: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 36,
      backgroundColor: colors.surface
    },
    gameCardBody: {
      marginTop: -4,
      backgroundColor: colors.surface,
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      paddingTop: spacing.md
    },
    cardEyebrow: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase"
    },
    gameTitle: {
      color: colors.foreground,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "800"
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
      fontWeight: "700"
    },
    pager: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm
    },
    pagerButton: {
      minHeight: 36,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      justifyContent: "center",
      paddingHorizontal: spacing.md
    },
    pagerButtonDisabled: {
      opacity: 0.45
    },
    pagerButtonText: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: "900"
    },
    pagerMeta: {
      color: colors.mutedStrong,
      fontSize: 12,
      fontWeight: "900"
    },
    backButton: {
      alignSelf: "flex-start",
      minHeight: 36,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md
    },
    backButtonText: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: "900"
    },
    detailHero: {
      position: "relative",
      overflow: "hidden",
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted
    },
    heroScrim: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "78%",
      backgroundColor: "rgba(0,0,0,0.58)"
    },
    detailHeroText: {
      position: "absolute",
      left: spacing.lg,
      right: spacing.lg,
      bottom: spacing.lg,
      gap: spacing.sm
    },
    detailTitle: {
      color: colors.white,
      fontSize: 30,
      lineHeight: 36,
      fontWeight: "900"
    },
    detailHeroMeta: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      alignItems: "center"
    },
    heroBadge: {
      overflow: "hidden",
      borderRadius: radii.sm,
      backgroundColor: colors.accentSoft,
      color: colors.white,
      fontSize: 11,
      fontWeight: "900",
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      textTransform: "uppercase"
    },
    heroMeta: {
      color: "rgba(255,255,255,0.82)",
      fontSize: 12,
      fontWeight: "800"
    },
    detailIntro: {
      color: colors.mutedStrong,
      fontSize: 16,
      lineHeight: 24
    },
    codesPanel: {
      overflow: "hidden",
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface
    },
    panelHeader: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.md,
      padding: spacing.lg
    },
    panelTitle: {
      color: colors.foreground,
      fontSize: 20,
      lineHeight: 26,
      fontWeight: "900"
    },
    panelSubtitle: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4
    },
    countBadge: {
      overflow: "hidden",
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceMuted,
      color: colors.foreground,
      fontSize: 12,
      fontWeight: "900",
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
      fontWeight: "900",
      paddingHorizontal: spacing.sm,
      paddingVertical: 6
    },
    codeList: {
      overflow: "hidden"
    },
    codeRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      padding: spacing.md
    },
    codeRowUsed: {
      opacity: 0.72
    },
    rowBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    codeNumber: {
      width: 34,
      height: 34,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center"
    },
    codeNumberText: {
      color: colors.mutedStrong,
      fontSize: 12,
      fontWeight: "900"
    },
    codeBody: {
      flex: 1,
      minWidth: 0,
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
      fontWeight: "900",
      letterSpacing: 1
    },
    codeTextUsed: {
      color: colors.muted,
      textDecorationLine: "line-through"
    },
    miniBadge: {
      overflow: "hidden",
      borderRadius: radii.sm,
      backgroundColor: colors.accentSoft,
      color: colors.accent,
      fontSize: 10,
      fontWeight: "900",
      paddingHorizontal: 6,
      paddingVertical: 3,
      textTransform: "uppercase"
    },
    mutedText: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20
    },
    usedMutedText: {
      textDecorationLine: "line-through"
    },
    addedText: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "700"
    },
    codeActions: {
      alignItems: "flex-end",
      gap: spacing.sm
    },
    uncheckButton: {
      width: 34,
      height: 34,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center"
    },
    copyButton: {
      minHeight: 34,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md
    },
    copyButtonDone: {
      backgroundColor: colors.accent,
      borderColor: colors.accent
    },
    copyButtonText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "900"
    },
    copyButtonDoneText: {
      color: colors.white
    },
    emptyState: {
      padding: spacing.lg,
      gap: spacing.xs
    },
    emptyTitle: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: "900"
    },
    expiredChipList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      padding: spacing.md
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
      fontWeight: "700"
    },
    robloxButton: {
      alignSelf: "flex-start",
      minHeight: 42,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg
    },
    robloxButtonText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "900"
    },
    accountCard: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: spacing.md,
      padding: spacing.xl
    },
    accountIcon: {
      width: 54,
      height: 54,
      borderRadius: radii.md,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center"
    },
    accountTitle: {
      color: colors.foreground,
      fontSize: 22,
      fontWeight: "900"
    },
    accountActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md
    },
    statePanel: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      gap: spacing.sm,
      alignItems: "flex-start"
    },
    stateText: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "800"
    },
    errorTitle: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: "900"
    },
    retryButton: {
      minHeight: 36,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft,
      justifyContent: "center",
      paddingHorizontal: spacing.md
    },
    retryButtonText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "900"
    }
  });
}
