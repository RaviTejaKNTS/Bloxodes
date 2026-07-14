import { useMemo, useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { radii, spacing } from "../theme";
import { useTheme } from "../theme-context";
import { formatUpdatedLabel } from "../format";
import type { MobileContentDetailItem, MobileContentDetailResponse, MobileContentDetailSection, MobileContentItem } from "../types";
import { AppIcon, Badge, Button, Card, CoverImage, Divider, MetaText } from "./ui";

export function ContentCard({ item, onPress, width }: { item: MobileContentItem; onPress: () => void; width?: number }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={width ? { width } : undefined}>
      <CoverImage source={item.coverImage} label={item.title} />
      <View style={{ gap: spacing.xs, padding: spacing.md }}>
        {item.badge ? <Badge label={item.badge} tone="accent" /> : null}
        <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 20, fontWeight: "800" }} numberOfLines={2}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}
        {item.updatedAt ? <MetaText>Updated {formatUpdatedLabel(item.updatedAt)}</MetaText> : null}
      </View>
    </Card>
  );
}

export function ContentRow({ item, onPress }: { item: MobileContentItem; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}
    >
      <View style={{ width: 52, height: 52, borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.surfaceMuted }}>
        {item.coverImage ? (
          <Image source={{ uri: item.coverImage }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.muted, fontSize: 18, fontWeight: "900" }}>{item.title.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
          {[item.badge, item.subtitle ?? item.summary].filter(Boolean).join(" · ") || "Bloxodes"}
        </Text>
      </View>
      <AppIcon name="chevron-right" size={16} color={colors.muted} />
    </TouchableOpacity>
  );
}

function DetailItemRow({ item, onPress }: { item: MobileContentDetailItem; onPress?: () => void }) {
  const { colors } = useTheme();
  const inner = (
    <View style={{ flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md }}>
      {item.image ? (
        <Image
          source={{ uri: item.image }}
          style={{ width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }}
          resizeMode="cover"
        />
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
          <Text style={{ flexShrink: 1, color: colors.foreground, fontSize: 14.5, fontWeight: "700" }}>{item.title}</Text>
          {item.badge ? <Badge label={item.badge} /> : null}
        </View>
        {item.subtitle ? (
          <Text style={{ color: colors.mutedStrong, fontSize: 13 }} numberOfLines={2}>
            {item.subtitle}
          </Text>
        ) : null}
        {item.body ? (
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }} numberOfLines={4}>
            {item.body}
          </Text>
        ) : null}
      </View>
      {onPress ? <AppIcon name="chevron-right" size={16} color={colors.muted} /> : null}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

export function DetailSectionCard({
  itemPressHandler,
  loadingMore,
  onLoadMore,
  section
}: {
  itemPressHandler?: (item: MobileContentDetailItem) => (() => void) | null;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  section: MobileContentDetailSection;
}) {
  const { colors } = useTheme();
  const hasMore = typeof section.totalPages === "number" && typeof section.page === "number" && section.page < section.totalPages;

  return (
    <Card>
      <View style={{ gap: 2, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: section.body || section.items.length ? spacing.sm : spacing.lg }}>
        <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800" }}>{section.title}</Text>
        {section.subtitle ? <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{section.subtitle}</Text> : null}
      </View>
      {section.body ? (
        <Text style={{ color: colors.mutedStrong, fontSize: 14.5, lineHeight: 22, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          {section.body}
        </Text>
      ) : null}
      {section.items.length ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          {section.items.map((item, index) => {
            const onPress = itemPressHandler ? itemPressHandler(item) : null;
            return (
              <View key={`${item.id}-${index}`}>
                {index > 0 ? <Divider /> : null}
                <DetailItemRow item={item} onPress={onPress ?? undefined} />
              </View>
            );
          })}
          {hasMore && onLoadMore ? (
            <TouchableOpacity
              onPress={onLoadMore}
              disabled={loadingMore}
              activeOpacity={0.85}
              style={{
                marginBottom: spacing.sm,
                minHeight: 40,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: loadingMore ? 0.6 : 1
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "800" }}>
                {loadingMore ? "Loading..." : `Load more (${section.page}/${section.totalPages})`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

function cleanMarkdownText(value: string): string {
  return value
    .replace(/!\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function MarkdownBlock({ body }: { body: string }) {
  const { colors } = useTheme();
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Array<{ kind: "heading" | "paragraph" | "quote" | "list"; text: string; level?: number; marker?: string }> = [];
  let paragraph: string[] = [];
  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({ kind: "paragraph", text: cleanMarkdownText(paragraph.join(" ")) });
    paragraph = [];
  }
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "heading", text: cleanMarkdownText(heading[2]), level: heading[1].length });
      continue;
    }
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    const ordered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (bullet || ordered) {
      flushParagraph();
      blocks.push({
        kind: "list",
        text: cleanMarkdownText(bullet ? bullet[1] : ordered![2]),
        marker: ordered ? `${ordered[1]}.` : "•"
      });
      continue;
    }
    if (line.startsWith(">")) {
      flushParagraph();
      blocks.push({ kind: "quote", text: cleanMarkdownText(line.replace(/^>\s?/, "")) });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();

  return (
    <View style={{ gap: spacing.md }}>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          const size = block.level === 1 ? 25 : block.level === 2 ? 22 : block.level === 3 ? 19 : 16;
          return <Text key={`${block.text}-${index}`} style={{ color: colors.foreground, fontSize: size, lineHeight: size + 7, fontWeight: "800", marginTop: index ? spacing.sm : 0 }}>{block.text}</Text>;
        }
        if (block.kind === "list") {
          return (
            <View key={`${block.text}-${index}`} style={{ flexDirection: "row", gap: spacing.sm, paddingLeft: spacing.sm }}>
              <Text style={{ color: colors.accent, fontSize: 15, lineHeight: 23, fontWeight: "800" }}>{block.marker}</Text>
              <Text style={{ flex: 1, color: colors.mutedStrong, fontSize: 15, lineHeight: 23 }}>{block.text}</Text>
            </View>
          );
        }
        if (block.kind === "quote") {
          return (
            <View key={`${block.text}-${index}`} style={{ borderLeftWidth: 3, borderLeftColor: colors.accentBorder, paddingLeft: spacing.md }}>
              <Text style={{ color: colors.mutedStrong, fontSize: 15, lineHeight: 23, fontStyle: "italic" }}>{block.text}</Text>
            </View>
          );
        }
        return <Text key={`${block.text}-${index}`} style={{ color: colors.mutedStrong, fontSize: 15, lineHeight: 24 }}>{block.text}</Text>;
      })}
    </View>
  );
}

function ProseBlock({ body }: { body: string }) {
  return <MarkdownBlock body={body} />;
}

function CollectionLinksSection({
  itemPressHandler,
  section
}: {
  itemPressHandler?: (item: MobileContentDetailItem) => (() => void) | null;
  section: MobileContentDetailSection;
}) {
  const { colors } = useTheme();
  if (!section.items.length) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800" }}>{section.title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
        {section.items.map((item) => {
          const onPress = itemPressHandler ? itemPressHandler(item) : null;
          const active = item.badge === "Current";
          return (
            <TouchableOpacity
              key={item.id}
              onPress={onPress ?? undefined}
              disabled={!onPress || active}
              activeOpacity={0.85}
              style={{
                minHeight: 36,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? colors.accentBorder : colors.border,
                backgroundColor: active ? colors.accentSoft : colors.surface,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: spacing.md
              }}
            >
              <Text style={{ color: active ? colors.accent : colors.foreground, fontSize: 13, fontWeight: "800" }}>{item.title}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function CollectionItemCard({ item }: { item: MobileContentDetailItem }) {
  const { colors } = useTheme();
  return (
    <Card>
      {item.image ? (
        <View style={{ aspectRatio: 4 / 3, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
          <Image source={{ uri: item.image }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
        </View>
      ) : null}
      <View style={{ gap: spacing.md, padding: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
            <Text style={{ flexShrink: 1, color: colors.foreground, fontSize: 18, lineHeight: 23, fontWeight: "800" }}>{item.title}</Text>
            {item.badge ? <Badge label={item.badge} /> : null}
          </View>
          {item.subtitle ? <Text style={{ color: colors.mutedStrong, fontSize: 13, lineHeight: 19 }}>{item.subtitle}</Text> : null}
          {item.body ? <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>{item.body}</Text> : null}
        </View>

        {item.fields?.length ? (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.borderMuted, gap: spacing.md, paddingTop: spacing.md }}>
            {item.fields.map((field) => (
              <View key={field.key} style={{ gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>{field.label}</Text>
                <Text
                  style={{
                    color: field.kind === "chip" ? colors.accent : colors.foreground,
                    fontSize: 14,
                    lineHeight: 20,
                    fontWeight: field.kind === "detail" ? "600" : "700"
                  }}
                >
                  {field.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function CollectionItemsTable({ items }: { items: MobileContentDetailItem[] }) {
  const { colors } = useTheme();
  const fields = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      for (const field of item.fields ?? []) map.set(field.key, field.label);
    }
    return Array.from(map.entries()).slice(0, 8);
  }, [items]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingBottom: spacing.sm }}>
      <View style={{ minWidth: 220 + fields.length * 132, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", backgroundColor: colors.surfaceMuted, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ width: 220, padding: spacing.md, color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>Item</Text>
          {fields.map(([key, label]) => (
            <Text key={key} style={{ width: 132, padding: spacing.md, color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>{label}</Text>
          ))}
        </View>
        {items.map((item, rowIndex) => {
          const values = new Map((item.fields ?? []).map((field) => [field.key, field.value]));
          return (
            <View key={`${item.id}-${rowIndex}`} style={{ flexDirection: "row", alignItems: "center", borderTopWidth: rowIndex ? 1 : 0, borderTopColor: colors.borderMuted, backgroundColor: colors.surface }}>
              <View style={{ width: 220, minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md }}>
                {item.image ? <Image source={{ uri: item.image }} style={{ width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted }} resizeMode="contain" /> : null}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 18, fontWeight: "800" }}>{item.title}</Text>
                  {item.body ? <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11, lineHeight: 15 }}>{item.body}</Text> : null}
                </View>
              </View>
              {fields.map(([key]) => (
                <Text key={key} style={{ width: 132, padding: spacing.md, color: colors.mutedStrong, fontSize: 12.5, lineHeight: 18 }}>{values.get(key) ?? "—"}</Text>
              ))}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function CollectionItemsSection({
  loadingMore,
  onLoadMore,
  section
}: {
  loadingMore?: boolean;
  onLoadMore?: () => void;
  section: MobileContentDetailSection;
}) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<"cards" | "table">("cards");
  if (!section.items.length) return null;
  const hasMore = typeof section.page === "number" && typeof section.totalPages === "number" && section.page < section.totalPages;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.foreground, fontSize: 22, lineHeight: 28, fontWeight: "800" }}>{section.title}</Text>
          {section.subtitle ? <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>{section.subtitle}</Text> : null}
        </View>
        <View style={{ flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, overflow: "hidden" }}>
          {(["cards", "table"] as const).map((value) => (
            <TouchableOpacity key={value} onPress={() => setMode(value)} style={{ minHeight: 34, justifyContent: "center", paddingHorizontal: spacing.md, backgroundColor: mode === value ? colors.surfaceMuted : colors.surface }}>
              <Text style={{ color: mode === value ? colors.foreground : colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>{value}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {mode === "cards" ? (
        <View style={{ gap: spacing.lg }}>
          {section.items.map((item, index) => <CollectionItemCard key={`${item.id}-${index}`} item={item} />)}
        </View>
      ) : <CollectionItemsTable items={section.items} />}
      {hasMore && onLoadMore ? <Button label={loadingMore ? "Loading..." : `Load more (${section.page}/${section.totalPages})`} variant="secondary" onPress={onLoadMore} disabled={loadingMore} /> : null}
    </View>
  );
}

function ProseSection({ section }: { section: MobileContentDetailSection }) {
  const { colors } = useTheme();
  if (!section.body && !section.items.length) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ color: colors.foreground, fontSize: 20, lineHeight: 25, fontWeight: "800" }}>{section.title}</Text>
      {section.body ? <ProseBlock body={section.body} /> : null}
      {section.items.length ? (
        <View style={{ gap: spacing.md }}>
          {section.items.map((item, index) => (
            <View key={`${item.id}-${index}`} style={{ gap: spacing.xs, borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.borderMuted, paddingTop: index > 0 ? spacing.md : 0 }}>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }}>{item.title}</Text>
              {item.body ? <Text style={{ color: colors.mutedStrong, fontSize: 14, lineHeight: 21 }}>{item.body}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FaqSection({ section }: { section: MobileContentDetailSection }) {
  const { colors } = useTheme();
  if (!section.items.length) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ color: colors.foreground, fontSize: 20, lineHeight: 25, fontWeight: "800" }}>{section.title}</Text>
      {section.items.map((item, index) => (
        <View key={`${item.id}-${index}`} style={{ gap: spacing.xs, borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.borderMuted, paddingTop: index > 0 ? spacing.md : 0 }}>
          <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 20, fontWeight: "800" }}>{item.title}</Text>
          {item.body ? <Text style={{ color: colors.mutedStrong, fontSize: 14, lineHeight: 21 }}>{item.body}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function DetailsGridSection({ section }: { section: MobileContentDetailSection }) {
  const { colors } = useTheme();
  if (!section.items.length) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ color: colors.foreground, fontSize: 22, lineHeight: 28, fontWeight: "800" }}>{section.title}</Text>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
        {section.items.map((item, index) => (
          <View key={`${item.id}-${index}`} style={{ flexDirection: "row", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderMuted, paddingVertical: spacing.md }}>
            <Text style={{ width: "38%", color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "800", textTransform: "uppercase" }}>{item.title}</Text>
            <Text style={{ flex: 1, color: colors.foreground, fontSize: 14, lineHeight: 21, fontWeight: "600" }}>{item.body ?? "—"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatTimelineDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function TimelineSection({ section }: { section: MobileContentDetailSection }) {
  const { colors } = useTheme();
  if (!section.items.length) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: 3 }}>
        <Text style={{ color: colors.foreground, fontSize: 22, lineHeight: 28, fontWeight: "800" }}>{section.title}</Text>
        {section.subtitle ? <Text style={{ color: colors.muted, fontSize: 13 }}>{section.subtitle}</Text> : null}
      </View>
      <View>
        {section.items.map((item, index) => {
          const tone = item.status === "current" ? colors.accent : item.status === "upcoming" ? "#d97706" : colors.muted;
          const start = formatTimelineDate(item.startAt);
          const end = formatTimelineDate(item.endAt);
          return (
            <View key={`${item.id}-${index}`} style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ width: 18, alignItems: "center" }}>
                <View style={{ width: 11, height: 11, borderRadius: 999, borderWidth: 2, borderColor: tone, backgroundColor: colors.background, marginTop: 5, zIndex: 1 }} />
                {index < section.items.length - 1 ? <View style={{ flex: 1, width: 1, minHeight: 74, backgroundColor: colors.border }} /> : null}
              </View>
              <View style={{ flex: 1, gap: spacing.xs, paddingBottom: index < section.items.length - 1 ? spacing.xl : 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                  <Text style={{ flexShrink: 1, color: colors.foreground, fontSize: 16, lineHeight: 21, fontWeight: "800" }}>{item.title}</Text>
                  {item.status ? <Badge label={item.status === "current" ? "Live" : item.status} tone={item.status === "current" ? "accent" : "default"} /> : null}
                </View>
                {start || end ? <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{[start ? `Starts ${start}` : null, end ? `Ends ${end}` : null].filter(Boolean).join("  ·  ")}</Text> : null}
                {item.body ? <Text style={{ color: colors.mutedStrong, fontSize: 14, lineHeight: 21 }}>{item.body}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function WikiStatsSection({ section }: { section: MobileContentDetailSection }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
      {section.items.slice(0, 3).map((item) => (
        <View key={item.id} style={{ width: "31%", minWidth: 96, flexGrow: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md, gap: 3, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>{item.title}</Text>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "900" }}>{item.body}</Text>
        </View>
      ))}
    </View>
  );
}

function WikiControlsSection({ section }: { section: MobileContentDetailSection }) {
  const { colors } = useTheme();
  const devices = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of section.items) for (const field of item.fields ?? []) map.set(field.key, field.label);
    return Array.from(map.entries());
  }, [section.items]);
  if (!section.items.length) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ color: colors.foreground, fontSize: 22, lineHeight: 28, fontWeight: "800" }}>{section.title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ minWidth: 160 + devices.length * 150, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", backgroundColor: colors.surfaceMuted }}>
            <Text style={{ width: 160, padding: spacing.md, color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>Action</Text>
            {devices.map(([key, label]) => <Text key={key} style={{ width: 150, padding: spacing.md, color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>{label}</Text>)}
          </View>
          {section.items.map((item, index) => {
            const values = new Map((item.fields ?? []).map((field) => [field.key, field.value]));
            return (
              <View key={item.id} style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.borderMuted, backgroundColor: colors.surface }}>
                <Text style={{ width: 160, padding: spacing.md, color: colors.foreground, fontSize: 13, lineHeight: 19, fontWeight: "800" }}>{item.title}</Text>
                {devices.map(([key]) => <Text key={key} style={{ width: 150, padding: spacing.md, color: colors.mutedStrong, fontSize: 13, lineHeight: 19 }}>{values.get(key) ?? "—"}</Text>)}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function WikiRelatedSection({ itemPressHandler, section }: { itemPressHandler?: (item: MobileContentDetailItem) => (() => void) | null; section: MobileContentDetailSection }) {
  const { colors } = useTheme();
  if (!section.items.length) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ color: colors.foreground, fontSize: 20, lineHeight: 26, fontWeight: "800" }}>{section.title}</Text>
      {section.items.map((item, index) => {
        const onPress = itemPressHandler?.(item) ?? null;
        return (
          <TouchableOpacity key={`${item.id}-${index}`} disabled={!onPress} onPress={onPress ?? undefined} activeOpacity={0.85} style={{ flexDirection: "row", gap: spacing.md, borderTopWidth: index ? 1 : 0, borderTopColor: colors.borderMuted, paddingTop: index ? spacing.md : 0 }}>
            {item.image ? <Image source={{ uri: item.image }} style={{ width: 64, height: 64, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }} resizeMode="cover" /> : null}
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                <Text style={{ flexShrink: 1, color: colors.foreground, fontSize: 15, fontWeight: "800" }}>{item.title}</Text>
                {item.badge ? <Badge label={item.badge} /> : null}
              </View>
              {item.body ? <Text numberOfLines={section.id === "catalog" ? undefined : 3} style={{ color: colors.mutedStrong, fontSize: 13.5, lineHeight: 20 }}>{cleanMarkdownText(item.body)}</Text> : null}
            </View>
            {onPress ? <AppIcon name="chevron-right" color={colors.muted} size={16} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function CollectionDetailView({
  detail,
  itemPressHandler,
  loadingSectionId,
  onLoadMore,
  onOpenWeb
}: {
  detail: MobileContentDetailResponse;
  itemPressHandler?: (sectionId: string) => (item: MobileContentDetailItem) => (() => void) | null;
  loadingSectionId?: string | null;
  onLoadMore?: (section: MobileContentDetailSection) => void;
  onOpenWeb: () => void;
}) {
  const { colors } = useTheme();
  const collectionSections = detail.sections.filter((section) => section.variant === "collection-items" && section.items.length);
  const contentSections = detail.sections.filter((section) => section.body || section.items.length);

  return (
    <>
      <View style={{ gap: spacing.sm }}>
        {detail.badge ? <Badge label={detail.badge} tone="accent" /> : null}
        <Text style={{ color: colors.foreground, fontSize: 26, lineHeight: 32, fontWeight: "900" }}>{detail.title}</Text>
        {detail.subtitle ? <Text style={{ color: colors.mutedStrong, fontSize: 15, lineHeight: 22, fontWeight: "700" }}>{detail.subtitle}</Text> : null}
        {detail.updatedAt ? <MetaText>Updated {formatUpdatedLabel(detail.updatedAt)}</MetaText> : null}
        {detail.summary ? <Text style={{ color: colors.mutedStrong, fontSize: 15, lineHeight: 23 }}>{detail.summary}</Text> : null}
      </View>

      {collectionSections.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
          {collectionSections.map((section) => (
            <View
              key={section.id}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                paddingHorizontal: spacing.md,
                paddingVertical: 7
              }}
            >
              <Text style={{ color: colors.mutedStrong, fontSize: 12, fontWeight: "800" }}>
                {[section.title, section.subtitle].filter(Boolean).join(" · ")}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {contentSections.map((section) => {
        if (section.variant === "links") {
          return <CollectionLinksSection key={section.id} section={section} itemPressHandler={itemPressHandler?.(section.id)} />;
        }
        if (section.variant === "collection-items") {
          return <CollectionItemsSection key={section.id} section={section} loadingMore={loadingSectionId === section.id} onLoadMore={onLoadMore ? () => onLoadMore(section) : undefined} />;
        }
        if (section.variant === "collection-details") {
          return <DetailsGridSection key={section.id} section={section} />;
        }
        if (section.variant === "faq") {
          return <FaqSection key={section.id} section={section} />;
        }
        return <ProseSection key={section.id} section={section} />;
      })}

      <Button icon="external-link" label="Open on bloxodes.com" variant="secondary" onPress={onOpenWeb} />
    </>
  );
}

export function WikiDetailView({
  detail,
  itemPressHandler,
  onOpenWeb
}: {
  detail: MobileContentDetailResponse;
  itemPressHandler?: (sectionId: string) => (item: MobileContentDetailItem) => (() => void) | null;
  onOpenWeb: () => void;
}) {
  const { colors } = useTheme();
  return (
    <>
      <View style={{ gap: spacing.lg }}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 }}>Wiki</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.lg }}>
          {detail.coverImage ? <Image source={{ uri: detail.coverImage }} style={{ width: 92, height: 92, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted }} resizeMode="cover" /> : null}
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Text style={{ color: colors.foreground, fontSize: 27, lineHeight: 33, fontWeight: "900" }}>{detail.title}</Text>
            {detail.updatedAt ? <MetaText>Updated {formatUpdatedLabel(detail.updatedAt)}</MetaText> : null}
          </View>
        </View>
      </View>

      {detail.sections.map((section) => {
        if (section.variant === "markdown" && section.body) {
          return <MarkdownBlock key={section.id} body={section.body} />;
        }
        if (section.variant === "stats") return <WikiStatsSection key={section.id} section={section} />;
        if (section.variant === "collection-details") return <DetailsGridSection key={section.id} section={section} />;
        if (section.variant === "timeline") return <TimelineSection key={section.id} section={section} />;
        if (section.id === "controls") return <WikiControlsSection key={section.id} section={section} />;
        if (section.id === "catalog") {
          return (
            <View key={section.id} style={{ gap: spacing.xl }}>
              {section.items.map((item, index) => {
                const onPress = itemPressHandler ? itemPressHandler(section.id)(item) : null;
                return (
                  <View key={`${item.id}-${index}`} style={{ gap: spacing.md }}>
                    <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800" }}>{item.title}</Text>
                    {item.body ? <MarkdownBlock body={item.body} /> : null}
                    <TouchableOpacity onPress={onPress ?? undefined} disabled={!onPress} style={{ minHeight: 78, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md, backgroundColor: colors.surface }}>
                      {item.image ? <Image source={{ uri: item.image }} style={{ width: 52, height: 52, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }} resizeMode="cover" /> : null}
                      <Text style={{ flex: 1, color: colors.foreground, fontSize: 15, fontWeight: "800" }}>Open {item.title}</Text>
                      <AppIcon name="chevron-right" color={colors.muted} size={18} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          );
        }
        if (!section.body && !section.items.length) return null;
        return <WikiRelatedSection key={section.id} section={section} itemPressHandler={itemPressHandler?.(section.id)} />;
      })}

      <Button icon="external-link" label="Open full wiki on bloxodes.com" variant="secondary" onPress={onOpenWeb} />
    </>
  );
}

export function EventsDetailView({ detail, onOpenWeb }: { detail: MobileContentDetailResponse; onOpenWeb: () => void }) {
  const { colors } = useTheme();
  const timeline = detail.sections.find((section) => section.variant === "timeline");
  return (
    <>
      {detail.coverImage ? <Image source={{ uri: detail.coverImage }} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radii.lg, backgroundColor: colors.surfaceMuted }} resizeMode="cover" /> : null}
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
          <Badge label="Events" tone="accent" />
          {detail.badge && detail.badge !== "Event" ? <Badge label={detail.badge} /> : null}
        </View>
        <Text style={{ color: colors.foreground, fontSize: 27, lineHeight: 33, fontWeight: "900" }}>{detail.title}</Text>
        {detail.subtitle ? <Text style={{ color: colors.mutedStrong, fontSize: 14, fontWeight: "700" }}>{detail.subtitle}</Text> : null}
      </View>
      {timeline ? <TimelineSection section={timeline} /> : <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>No scheduled events are currently available.</Text>}
      <Button icon="external-link" label="Open events page on bloxodes.com" variant="secondary" onPress={onOpenWeb} />
    </>
  );
}
