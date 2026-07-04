import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { fetchSearchResults } from "../../src/api";
import { routeForWebUrl, SECTION_DESCRIPTIONS, SECTION_KINDS, SECTION_LABELS } from "../../src/links";
import { radii, spacing } from "../../src/theme";
import { useTheme } from "../../src/theme-context";
import { AppIcon, Badge, Card, Divider, EmptyState, LoadingState, SearchBar, type FeatherIconName } from "../../src/components/ui";
import type { MobileContentKind, SearchItem } from "../../src/types";

const SECTION_ICONS: Record<MobileContentKind, FeatherIconName> = {
  articles: "file-text",
  catalog: "database",
  checklists: "check-square",
  events: "calendar",
  quizzes: "help-circle",
  tools: "tool",
  wiki: "book-open"
};

const SEARCH_TYPE_LABELS: Record<string, string> = {
  article: "Article",
  author: "Author",
  catalog: "Catalog",
  checklist: "Checklist",
  codes: "Codes",
  event: "Event",
  music: "Music",
  quiz: "Quiz",
  tool: "Tool",
  wiki: "Wiki"
};

function SectionTile({ kind, onPress }: { kind: MobileContentKind; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.md,
            backgroundColor: colors.accentSoft,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <AppIcon name={SECTION_ICONS[kind]} size={19} color={colors.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800" }}>{SECTION_LABELS[kind]}</Text>
          {SECTION_DESCRIPTIONS[kind] ? (
            <Text style={{ color: colors.muted, fontSize: 12.5 }} numberOfLines={1}>
              {SECTION_DESCRIPTIONS[kind]}
            </Text>
          ) : null}
        </View>
        <AppIcon name="chevron-right" size={16} color={colors.muted} />
      </View>
    </Card>
  );
}

function SearchResultRow({ item, onPress }: { item: SearchItem; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }} numberOfLines={2}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text style={{ color: colors.muted, fontSize: 12.5 }} numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}
      </View>
      <Badge label={SEARCH_TYPE_LABELS[item.type] ?? item.type} />
      <AppIcon name="chevron-right" size={16} color={colors.muted} />
    </TouchableOpacity>
  );
}

export default function BrowseScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const response = await fetchSearchResults(trimmed);
        setResults(response.items ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
        setSearched(true);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [searchText]);

  function openResult(item: SearchItem) {
    const route = routeForWebUrl(item.url);
    if (route) {
      router.push(route as never);
    } else {
      void Linking.openURL(item.url);
    }
  }

  const showSearch = searchText.trim().length >= 2;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      <SearchBar value={searchText} onChangeText={setSearchText} placeholder="Search Bloxodes" />

      {showSearch ? (
        <Card>
          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
            {searching ? <LoadingState label="Searching" /> : null}
            {!searching && searched && !results.length ? (
              <EmptyState title="No results" body="Try a different search term." />
            ) : null}
            {!searching
              ? results.map((item, index) => (
                  <View key={item.id}>
                    {index > 0 ? <Divider /> : null}
                    <SearchResultRow item={item} onPress={() => openResult(item)} />
                  </View>
                ))
              : null}
          </View>
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {SECTION_KINDS.map((kind) => (
            <SectionTile key={kind} kind={kind} onPress={() => router.push(`/section/${kind}` as never)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
