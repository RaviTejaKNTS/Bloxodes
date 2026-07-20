import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState, type MutableRefObject, type ReactElement } from "react";
import {
  Image,
  Linking,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type ScrollView as ScrollViewType
} from "react-native";
import { radii, spacing, type ThemeColors } from "../theme";
import { useTheme } from "../theme-context";
import { formatDate, formatUpdatedLabel, relativeTimeLabel } from "../format";
import type {
  MobileContentDetailField,
  MobileContentDetailFieldTone,
  MobileContentDetailItem,
  MobileContentDetailResponse,
  MobileContentDetailSection,
  MobileContentItem
} from "../types";
import { AppIcon, Badge, Button, Card, CoverImage, Divider, MetaText, SearchBar, type FeatherIconName } from "./ui";
import { Markdown } from "./markdown";

export function MarkdownBlock({ body }: { body: string }) {
  return <Markdown body={body} />;
}

function cleanInlineText(value: string): string {
  return value
    .replace(/!\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function toneColors(tone: MobileContentDetailFieldTone | null | undefined, kind: MobileContentDetailField["kind"], colors: ThemeColors) {
  if (tone === "positive") return { background: colors.successSoft, text: colors.success };
  if (tone === "negative") return { background: colors.dangerSoft, text: colors.danger };
  if (tone === "warning") return { background: colors.warningSoft, text: colors.warning };
  if (kind === "chip") return { background: colors.accentSoft, text: colors.accent };
  return { background: colors.surfaceMuted, text: colors.mutedStrong };
}

export function ContentCard({ item, onPress, width }: { item: MobileContentItem; onPress: () => void; width?: number }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={width ? { width } : undefined}>
      <CoverImage source={item.coverImage} label={item.title} />
      <View style={{ gap: spacing.xs, padding: spacing.md }}>
        {item.badge ? <Badge label={item.badge} tone="accent" /> : null}
        <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 20, fontWeight: "700" }} numberOfLines={2}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "500" }} numberOfLines={1}>
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
            <Text style={{ color: colors.muted, fontSize: 18, fontWeight: "700" }}>{item.title.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }} numberOfLines={2}>
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

function CopyPill({ value, label }: { value: string; label?: string }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <TouchableOpacity
      onPress={() => {
        void Clipboard.setStringAsync(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      activeOpacity={0.85}
      style={{
        minHeight: 34,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: copied ? colors.accentDark : colors.accentBorder,
        backgroundColor: copied ? colors.accentDark : colors.accentSoft,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: spacing.md
      }}
    >
      <AppIcon name={copied ? "check" : "copy"} size={13} color={copied ? colors.white : colors.accent} />
      <Text style={{ color: copied ? colors.white : colors.accent, fontSize: 12, fontWeight: "700" }}>
        {copied ? "Copied" : label ?? "Copy"}
      </Text>
    </TouchableOpacity>
  );
}

function FieldPills({ fields }: { fields: MobileContentDetailField[] }) {
  const { colors } = useTheme();
  const compact = fields.filter((field) => field.kind !== "detail");
  if (!compact.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: 2 }}>
      {compact.map((field) => {
        const tone = toneColors(field.tone, field.kind, colors);
        return (
          <View
            key={field.key}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              borderRadius: 999,
              backgroundColor: tone.background,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "600" }}>{field.label}</Text>
            <Text style={{ color: tone.text, fontSize: 11.5, fontWeight: "700" }} numberOfLines={1}>
              {field.value}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function DetailItemRow({ item, onPress }: { item: MobileContentDetailItem; onPress?: () => void }) {
  const { colors } = useTheme();
  const detailFields = (item.fields ?? []).filter((field) => field.kind === "detail");
  const inner = (
    <View style={{ flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md }}>
      {item.color ? (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radii.md,
            backgroundColor: item.color,
            borderWidth: 1,
            borderColor: colors.border
          }}
        />
      ) : item.image ? (
        <Image
          source={{ uri: item.image }}
          style={{ width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }}
          resizeMode="cover"
        />
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
          <Text style={{ flexShrink: 1, color: colors.foreground, fontSize: 14.5, fontWeight: "600" }}>{item.title}</Text>
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
        {item.fields?.length ? <FieldPills fields={item.fields} /> : null}
        {detailFields.map((field) => (
          <Text key={field.key} style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18 }} numberOfLines={3}>
            <Text style={{ fontWeight: "600", color: colors.mutedStrong }}>{field.label}: </Text>
            {field.value}
          </Text>
        ))}
      </View>
      {item.copyValue ? (
        <View style={{ justifyContent: "center" }}>
          <CopyPill value={item.copyValue} />
        </View>
      ) : null}
      {onPress && !item.copyValue ? (
        <View style={{ justifyContent: "center" }}>
          <AppIcon name="chevron-right" size={16} color={colors.muted} />
        </View>
      ) : null}
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
      <View
        style={{
          gap: 2,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: section.body || section.items.length ? spacing.sm : spacing.lg
        }}
      >
        <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>{section.title}</Text>
        {section.subtitle ? <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "500" }}>{section.subtitle}</Text> : null}
      </View>
      {section.body ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          {section.variant === "markdown" ? (
            <Markdown body={section.body} />
          ) : (
            <Text style={{ color: colors.mutedStrong, fontSize: 14.5, lineHeight: 22 }}>{section.body}</Text>
          )}
        </View>
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
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "700" }}>
                {loadingMore ? "Loading..." : `Load more (${section.page}/${section.totalPages})`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

export function ActiveCodesSection({ onViewAll, section }: { onViewAll?: () => void; section: MobileContentDetailSection }) {
  const { colors } = useTheme();
  if (!section.items.length) return null;
  return (
    <Card>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm
        }}
      >
        <Text style={{ flex: 1, color: colors.foreground, fontSize: 18, lineHeight: 24, fontWeight: "700" }}>{section.title}</Text>
        {section.subtitle ? <Badge label={section.subtitle} tone="accent" /> : null}
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        {section.items.map((item, index) => (
          <View key={`${item.id}-${index}`}>
            {index > 0 ? <Divider /> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                  <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800", letterSpacing: 0.8 }}>{item.title}</Text>
                  {item.badge ? <Badge label={item.badge} tone="accent" /> : null}
                  {item.subtitle ? <Badge label={item.subtitle} /> : null}
                </View>
                {item.body ? (
                  <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                    {item.body}
                  </Text>
                ) : null}
                {item.startAt ? <MetaText>Added {formatDate(item.startAt)}</MetaText> : null}
              </View>
              {item.copyValue ? <CopyPill value={item.copyValue} /> : null}
            </View>
          </View>
        ))}
        {onViewAll ? (
          <TouchableOpacity
            onPress={onViewAll}
            activeOpacity={0.85}
            style={{
              marginTop: spacing.xs,
              marginBottom: spacing.sm,
              minHeight: 40,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6
            }}
          >
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "700" }}>View all codes</Text>
            <AppIcon name="chevron-right" size={14} color={colors.accent} />
          </TouchableOpacity>
        ) : null}
      </View>
    </Card>
  );
}

const SOCIAL_ICONS: Record<string, FeatherIconName> = {
  twitter: "twitter",
  x: "twitter",
  youtube: "youtube",
  discord: "message-circle",
  twitch: "twitch",
  facebook: "facebook",
  roblox: "globe",
  roblox_group: "globe",
  guilded: "globe"
};

export function SocialLinksSection({ section }: { section: MobileContentDetailSection }) {
  const { colors } = useTheme();
  if (!section.items.length) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>{section.title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {section.items.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => (item.url ? void Linking.openURL(item.url) : undefined)}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              minHeight: 38,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: spacing.md
            }}
          >
            <AppIcon name={SOCIAL_ICONS[item.badge ?? ""] ?? "globe"} size={14} color={colors.mutedStrong} />
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export function CollectionCtaCard({ item, label, onPress }: { item: MobileContentDetailItem; label?: string; onPress?: () => void }) {
  const { colors, isDark } = useTheme();
  const images = (item.images ?? []).slice(0, 5);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
      style={{
        minHeight: 96,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        backgroundColor: colors.surface
      }}
    >
      {images.length ? (
        <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, flexDirection: "row", opacity: 0.55 }}>
          {images.map((image, index) => (
            <Image key={`${image}-${index}`} source={{ uri: image }} style={{ flex: 1, height: "100%" }} resizeMode="cover" />
          ))}
        </View>
      ) : null}
      <View
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: isDark ? "rgba(0, 0, 0, 0.72)" : "rgba(255, 255, 255, 0.82)"
        }}
      />
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg }}>
        <Text style={{ flex: 1, color: colors.foreground, fontSize: 15, lineHeight: 21, fontWeight: "700" }}>
          {label ?? `Open ${item.title}`}
        </Text>
        <AppIcon name="chevron-right" size={18} color={colors.foreground} />
      </View>
    </TouchableOpacity>
  );
}

export function ImageLightbox({
  image,
  onClose,
  title
}: {
  image: string | null;
  onClose: () => void;
  title?: string | null;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={Boolean(image)} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.88)", alignItems: "center", justifyContent: "center", padding: spacing.lg }}
      >
        {image ? (
          <Image source={{ uri: image }} style={{ width: "100%", height: "70%" }} resizeMode="contain" />
        ) : null}
        {title ? (
          <Text style={{ color: colors.white, fontSize: 15, fontWeight: "600", marginTop: spacing.md, textAlign: "center" }}>{title}</Text>
        ) : null}
        <View
          style={{
            position: "absolute",
            top: 56,
            right: 24,
            width: 38,
            height: 38,
            borderRadius: 999,
            backgroundColor: "rgba(255, 255, 255, 0.14)",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <AppIcon name="x" size={18} color={colors.white} />
        </View>
      </TouchableOpacity>
    </Modal>
  );
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
      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>{section.title}</Text>
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
              <Text style={{ color: active ? colors.accent : colors.foreground, fontSize: 13, fontWeight: "700" }}>{item.title}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function CollectionFieldRows({ fields }: { fields: MobileContentDetailField[] }) {
  const { colors } = useTheme();
  const compact = fields.filter((field) => field.kind !== "detail");
  const detail = fields.filter((field) => field.kind === "detail");
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.borderMuted, paddingTop: spacing.md, gap: spacing.md }}>
      {compact.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          {compact.map((field) => {
            const tone = toneColors(field.tone, field.kind, colors);
            const chip = field.kind === "chip" || (field.tone && field.tone !== "neutral");
            return (
              <View key={field.key} style={{ flexBasis: "45%", flexGrow: 1, gap: 4, minWidth: 0 }}>
                <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {field.label}
                </Text>
                {chip ? (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      borderRadius: 999,
                      backgroundColor: tone.background,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 3
                    }}
                  >
                    <Text style={{ color: tone.text, fontSize: 12.5, fontWeight: "700" }}>{field.value}</Text>
                  </View>
                ) : (
                  <Text style={{ color: colors.foreground, fontSize: 13.5, lineHeight: 19, fontWeight: "600" }}>{field.value}</Text>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
      {detail.map((field) => (
        <View key={field.key} style={{ gap: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 }}>
            {field.label}
          </Text>
          <Text style={{ color: colors.mutedStrong, fontSize: 13.5, lineHeight: 20 }}>{field.value}</Text>
        </View>
      ))}
    </View>
  );
}

function CollectionItemCard({ item, onImagePress }: { item: MobileContentDetailItem; onImagePress?: (image: string, title: string) => void }) {
  const { colors } = useTheme();
  return (
    <Card>
      {item.image ? (
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={!onImagePress}
          onPress={() => (item.image && onImagePress ? onImagePress(item.image, item.title) : undefined)}
          style={{ aspectRatio: 4 / 3, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", padding: spacing.lg }}
        >
          <Image source={{ uri: item.image }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
        </TouchableOpacity>
      ) : null}
      <View style={{ gap: spacing.md, padding: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
            <Text style={{ flexShrink: 1, color: colors.foreground, fontSize: 17, lineHeight: 22, fontWeight: "700" }}>{item.title}</Text>
            {item.badge ? <Badge label={item.badge} tone="accent" /> : null}
          </View>
          {item.subtitle ? <Text style={{ color: colors.mutedStrong, fontSize: 13, lineHeight: 19 }}>{item.subtitle}</Text> : null}
          {item.body ? <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>{item.body}</Text> : null}
        </View>
        {item.fields?.length ? <CollectionFieldRows fields={item.fields} /> : null}
      </View>
    </Card>
  );
}

function CollectionItemsTable({
  items,
  onImagePress
}: {
  items: MobileContentDetailItem[];
  onImagePress?: (image: string, title: string) => void;
}) {
  const { colors } = useTheme();
  const fields = useMemo(() => {
    const map = new Map<string, { label: string; kind: MobileContentDetailField["kind"] }>();
    for (const item of items) {
      for (const field of item.fields ?? []) {
        if (!map.has(field.key)) map.set(field.key, { label: field.label, kind: field.kind });
      }
    }
    return Array.from(map.entries()).slice(0, 8);
  }, [items]);

  const columnWidth = (kind: MobileContentDetailField["kind"]) => (kind === "detail" ? 190 : 124);
  const totalWidth = 210 + fields.reduce((sum, [, meta]) => sum + columnWidth(meta.kind), 0);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingBottom: spacing.sm }}>
      <View style={{ minWidth: totalWidth, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", backgroundColor: colors.surfaceMuted, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ width: 210, padding: spacing.md, color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
            Item
          </Text>
          {fields.map(([key, meta]) => (
            <Text
              key={key}
              style={{
                width: columnWidth(meta.kind),
                padding: spacing.md,
                color: colors.muted,
                fontSize: 11,
                fontWeight: "700",
                textTransform: "uppercase"
              }}
            >
              {meta.label}
            </Text>
          ))}
        </View>
        {items.map((item, rowIndex) => {
          const values = new Map((item.fields ?? []).map((field) => [field.key, field]));
          return (
            <View
              key={`${item.id}-${rowIndex}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderTopWidth: rowIndex ? 1 : 0,
                borderTopColor: colors.borderMuted,
                backgroundColor: colors.surface
              }}
            >
              <View style={{ width: 210, minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md }}>
                {item.image ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={!onImagePress}
                    onPress={() => (item.image && onImagePress ? onImagePress(item.image, item.title) : undefined)}
                  >
                    <Image
                      source={{ uri: item.image }}
                      style={{ width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted }}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                ) : null}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 18, fontWeight: "700" }}>{item.title}</Text>
                  {item.body ? (
                    <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11, lineHeight: 15 }}>
                      {item.body}
                    </Text>
                  ) : null}
                </View>
              </View>
              {fields.map(([key, meta]) => {
                const field = values.get(key);
                const tone = field ? toneColors(field.tone, field.kind, colors) : null;
                const toned = field && (field.kind === "chip" || (field.tone && field.tone !== "neutral"));
                return (
                  <View key={key} style={{ width: columnWidth(meta.kind), padding: spacing.md }}>
                    {field ? (
                      toned && tone ? (
                        <View
                          style={{
                            alignSelf: "flex-start",
                            borderRadius: 999,
                            backgroundColor: tone.background,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 2
                          }}
                        >
                          <Text style={{ color: tone.text, fontSize: 12, fontWeight: "700" }}>{field.value}</Text>
                        </View>
                      ) : (
                        <Text style={{ color: colors.mutedStrong, fontSize: 12.5, lineHeight: 18 }}>{field.value}</Text>
                      )
                    ) : (
                      <Text style={{ color: colors.muted, fontSize: 12.5 }}>-</Text>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function CollectionItemsSection({
  loadingMore,
  mode,
  onImagePress,
  onLoadMore,
  section
}: {
  loadingMore?: boolean;
  mode: "cards" | "table";
  onImagePress?: (image: string, title: string) => void;
  onLoadMore?: () => void;
  section: MobileContentDetailSection;
}) {
  const { colors } = useTheme();
  if (!section.items.length) return null;
  const hasMore = typeof section.page === "number" && typeof section.totalPages === "number" && section.page < section.totalPages;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.foreground, fontSize: 21, lineHeight: 27, fontWeight: "700" }}>{section.title}</Text>
          {section.subtitle ? <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{section.subtitle}</Text> : null}
        </View>
      </View>
      {mode === "cards" ? (
        <View style={{ gap: spacing.lg }}>
          {section.items.map((item, index) => (
            <CollectionItemCard key={`${item.id}-${index}`} item={item} onImagePress={onImagePress} />
          ))}
        </View>
      ) : (
        <CollectionItemsTable items={section.items} onImagePress={onImagePress} />
      )}
      {hasMore && onLoadMore ? (
        <Button
          label={loadingMore ? "Loading..." : `Load more (${section.page}/${section.totalPages})`}
          variant="secondary"
          onPress={onLoadMore}
          disabled={loadingMore}
        />
      ) : null}
    </View>
  );
}

function ProseSection({ section }: { section: MobileContentDetailSection }) {
  const { colors } = useTheme();
  if (!section.body && !section.items.length) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ color: colors.foreground, fontSize: 20, lineHeight: 25, fontWeight: "700" }}>{section.title}</Text>
      {section.body ? <Markdown body={section.body} /> : null}
      {section.items.length ? (
        <View style={{ gap: spacing.md }}>
          {section.items.map((item, index) => (
            <View
              key={`${item.id}-${index}`}
              style={{ gap: spacing.xs, borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.borderMuted, paddingTop: index > 0 ? spacing.md : 0 }}
            >
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>{item.title}</Text>
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
      <Text style={{ color: colors.foreground, fontSize: 20, lineHeight: 25, fontWeight: "700" }}>{section.title}</Text>
      {section.items.map((item, index) => (
        <View
          key={`${item.id}-${index}`}
          style={{ gap: spacing.xs, borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.borderMuted, paddingTop: index > 0 ? spacing.md : 0 }}
        >
          <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 20, fontWeight: "700" }}>{item.title}</Text>
          {item.body ? <Markdown body={item.body} /> : null}
        </View>
      ))}
    </View>
  );
}

const GAME_DETAIL_ICONS: Record<string, FeatherIconName> = {
  creator: "user",
  created: "calendar",
  "game-updated": "refresh-cw",
  age: "shield",
  genre: "tag",
  subgenre: "tag",
  "max-players": "users",
  devices: "monitor",
  "private-server": "server"
};

function DetailsGridSection({ section }: { section: MobileContentDetailSection }) {
  const { colors } = useTheme();
  if (!section.items.length) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ color: colors.foreground, fontSize: 21, lineHeight: 27, fontWeight: "700" }}>{section.title}</Text>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
        {section.items.map((item, index) => {
          const icon = GAME_DETAIL_ICONS[item.id];
          const isDevices = item.id === "devices";
          return (
            <View
              key={`${item.id}-${index}`}
              style={{ flexDirection: "row", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderMuted, paddingVertical: spacing.md }}
            >
              <View style={{ width: "38%", flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
                {icon ? <AppIcon name={icon} size={14} color={colors.accent} /> : null}
                <Text style={{ flex: 1, color: colors.muted, fontSize: 11.5, lineHeight: 17, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {item.title}
                </Text>
              </View>
              {isDevices && item.body ? (
                <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                  {item.body.split(",").map((device) => (
                    <View
                      key={device.trim()}
                      style={{
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.accentBorder,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2
                      }}
                    >
                      <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>{device.trim()}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ flex: 1, color: colors.foreground, fontSize: 14, lineHeight: 21, fontWeight: "500" }}>{item.body ?? "-"}</Text>
              )}
            </View>
          );
        })}
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
        <Text style={{ color: colors.foreground, fontSize: 21, lineHeight: 27, fontWeight: "700" }}>{section.title}</Text>
        {section.subtitle ? <Text style={{ color: colors.muted, fontSize: 13 }}>{section.subtitle}</Text> : null}
      </View>
      <View>
        {section.items.map((item, index) => {
          const statusMeta =
            item.status === "current"
              ? { color: colors.info, background: colors.infoSoft, label: "Live now" }
              : item.status === "upcoming"
                ? { color: colors.success, background: colors.successSoft, label: relativeTimeLabel(item.startAt) ? `Starts ${relativeTimeLabel(item.startAt)}` : "Upcoming" }
                : { color: colors.muted, background: colors.surfaceMuted, label: "Completed" };
          const start = formatTimelineDate(item.startAt);
          const end = formatTimelineDate(item.endAt);
          return (
            <View key={`${item.id}-${index}`} style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ width: 18, alignItems: "center" }}>
                <View
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: 999,
                    borderWidth: 2,
                    borderColor: statusMeta.color,
                    backgroundColor: colors.background,
                    marginTop: 5,
                    zIndex: 1
                  }}
                />
                {index < section.items.length - 1 ? <View style={{ flex: 1, width: 1, minHeight: 74, backgroundColor: colors.border }} /> : null}
              </View>
              <View style={{ flex: 1, gap: spacing.xs, paddingBottom: index < section.items.length - 1 ? spacing.xl : 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                  <Text style={{ flexShrink: 1, color: colors.foreground, fontSize: 16, lineHeight: 21, fontWeight: "700" }}>{item.title}</Text>
                  {item.status ? (
                    <View style={{ borderRadius: 999, backgroundColor: statusMeta.background, paddingHorizontal: spacing.sm, paddingVertical: 3 }}>
                      <Text style={{ color: statusMeta.color, fontSize: 11.5, fontWeight: "700" }}>{statusMeta.label}</Text>
                    </View>
                  ) : null}
                </View>
                {start || end ? (
                  <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
                    {[start ? `Starts ${start}` : null, end ? `Ends ${end}` : null].filter(Boolean).join("  ·  ")}
                  </Text>
                ) : null}
                {item.body ? <Text style={{ color: colors.mutedStrong, fontSize: 14, lineHeight: 21 }}>{item.body}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function WikiStatsSection({ onPress, section }: { onPress?: () => void; section: MobileContentDetailSection }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
      {section.items.slice(0, 3).map((item) => (
        <TouchableOpacity
          key={item.id}
          onPress={onPress}
          disabled={!onPress}
          activeOpacity={0.85}
          style={{
            width: "31%",
            minWidth: 96,
            flexGrow: 1,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.lg,
            padding: spacing.md,
            gap: 3,
            backgroundColor: colors.surface
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>{item.title}</Text>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "800" }}>{item.body}</Text>
          {onPress ? <Text style={{ color: colors.accent, fontSize: 10.5, fontWeight: "600" }}>Stats page</Text> : null}
        </TouchableOpacity>
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
      <Text style={{ color: colors.foreground, fontSize: 21, lineHeight: 27, fontWeight: "700" }}>{section.title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ minWidth: 160 + devices.length * 150, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", backgroundColor: colors.surfaceMuted }}>
            <Text style={{ width: 160, padding: spacing.md, color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
              Action
            </Text>
            {devices.map(([key, label]) => (
              <Text key={key} style={{ width: 150, padding: spacing.md, color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
                {label}
              </Text>
            ))}
          </View>
          {section.items.map((item) => {
            const values = new Map((item.fields ?? []).map((field) => [field.key, field.value]));
            return (
              <View key={item.id} style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.borderMuted, backgroundColor: colors.surface }}>
                <Text style={{ width: 160, padding: spacing.md, color: colors.foreground, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>
                  {item.title}
                </Text>
                {devices.map(([key]) => (
                  <Text key={key} style={{ width: 150, padding: spacing.md, color: colors.mutedStrong, fontSize: 13, lineHeight: 19 }}>
                    {values.get(key) ?? "-"}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function MediaGridSection({ section }: { section: MobileContentDetailSection }) {
  const { colors } = useTheme();
  const withImages = section.items.filter((item) => item.image);
  if (!withImages.length) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ color: colors.foreground, fontSize: 20, lineHeight: 26, fontWeight: "700" }}>{section.title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {withImages.slice(0, 6).map((item, index) => (
          <View
            key={`${item.id}-${index}`}
            style={{ width: "48%", flexGrow: 1, borderRadius: radii.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}
          >
            <Image
              source={{ uri: item.image! }}
              style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surfaceMuted }}
              resizeMode="cover"
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function WikiRelatedSection({
  itemPressHandler,
  section
}: {
  itemPressHandler?: (item: MobileContentDetailItem) => (() => void) | null;
  section: MobileContentDetailSection;
}) {
  const { colors } = useTheme();
  if (!section.items.length) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ color: colors.foreground, fontSize: 20, lineHeight: 26, fontWeight: "700" }}>{section.title}</Text>
      {section.items.map((item, index) => {
        const onPress = itemPressHandler?.(item) ?? null;
        return (
          <TouchableOpacity
            key={`${item.id}-${index}`}
            disabled={!onPress}
            onPress={onPress ?? undefined}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              gap: spacing.md,
              borderTopWidth: index ? 1 : 0,
              borderTopColor: colors.borderMuted,
              paddingTop: index ? spacing.md : 0
            }}
          >
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={{ width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }}
                resizeMode="cover"
              />
            ) : null}
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                <Text style={{ flexShrink: 1, color: colors.foreground, fontSize: 15, fontWeight: "600" }}>{item.title}</Text>
                {item.badge ? <Badge label={item.badge} /> : null}
              </View>
              {item.subtitle ? (
                <Text style={{ color: colors.mutedStrong, fontSize: 13 }} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
              {item.body ? (
                <Text numberOfLines={3} style={{ color: colors.mutedStrong, fontSize: 13.5, lineHeight: 20 }}>
                  {cleanInlineText(item.body)}
                </Text>
              ) : null}
              {item.fields?.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: 2 }}>
                  {item.fields.map((field) => (
                    <View key={field.key} style={{ minWidth: 64, gap: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "600" }}>{field.label}</Text>
                      <Text style={{ color: colors.foreground, fontSize: 12.5, fontWeight: "600" }}>{field.value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            {onPress ? <AppIcon name="chevron-right" color={colors.muted} size={16} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function SectionAnchorChips({
  entries,
  onPress
}: {
  entries: Array<{ id: string; label: string }>;
  onPress: (id: string) => void;
}) {
  const { colors } = useTheme();
  if (entries.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
      {entries.map((entry) => (
        <TouchableOpacity
          key={entry.id}
          onPress={() => onPress(entry.id)}
          activeOpacity={0.85}
          style={{
            minHeight: 34,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.md
          }}
        >
          <Text style={{ color: colors.mutedStrong, fontSize: 12.5, fontWeight: "600" }}>{entry.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function useSectionAnchors(scrollRef?: MutableRefObject<ScrollViewType | null>) {
  const offsets = useRef<Record<string, number>>({});
  const register = (id: string) => (event: LayoutChangeEvent) => {
    offsets.current[id] = event.nativeEvent.layout.y;
  };
  const scrollTo = (id: string) => {
    const y = offsets.current[id];
    if (typeof y === "number" && scrollRef?.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - spacing.sm), animated: true });
    }
  };
  return { register, scrollTo };
}

export function CollectionDetailView({
  detail,
  itemPressHandler,
  loadingSectionId,
  onLoadMore,
  onOpenWeb,
  onQueryChange,
  query,
  scrollRef
}: {
  detail: MobileContentDetailResponse;
  itemPressHandler?: (sectionId: string) => (item: MobileContentDetailItem) => (() => void) | null;
  loadingSectionId?: string | null;
  onLoadMore?: (section: MobileContentDetailSection) => void;
  onOpenWeb: () => void;
  onQueryChange?: (value: string) => void;
  query?: string;
  scrollRef?: MutableRefObject<ScrollViewType | null>;
}) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<"cards" | "table">("cards");
  const [lightbox, setLightbox] = useState<{ image: string; title: string } | null>(null);
  const anchors = useSectionAnchors(scrollRef);
  const collectionSections = detail.sections.filter((section) => section.variant === "collection-items" && section.items.length);
  const contentSections = detail.sections.filter((section) => section.body || section.items.length);
  const totalItems = collectionSections.reduce((sum, section) => sum + (section.total ?? section.items.length), 0);

  return (
    <>
      <View style={{ gap: spacing.sm }}>
        {detail.badge ? <Badge label={detail.badge} tone="accent" /> : null}
        <Text style={{ color: colors.foreground, fontSize: 25, lineHeight: 31, fontWeight: "800" }}>{detail.title}</Text>
        {detail.subtitle ? (
          <Text style={{ color: colors.mutedStrong, fontSize: 15, lineHeight: 22, fontWeight: "600" }}>{detail.subtitle}</Text>
        ) : null}
        {detail.updatedAt ? <MetaText>Updated {formatUpdatedLabel(detail.updatedAt)}</MetaText> : null}
        {detail.summary ? <Text style={{ color: colors.mutedStrong, fontSize: 15, lineHeight: 23 }}>{detail.summary}</Text> : null}
      </View>

      {onQueryChange ? (
        <SearchBar value={query ?? ""} onChangeText={onQueryChange} placeholder={`Search ${totalItems ? `${totalItems} items` : "items"}`} />
      ) : null}

      {collectionSections.length ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
          {collectionSections.length > 1 ? (
            <View style={{ flex: 1, minWidth: 0 }}>
              <SectionAnchorChips
                entries={collectionSections.map((section) => ({
                  id: section.id,
                  label: [section.title, section.subtitle].filter(Boolean).join(" · ")
                }))}
                onPress={anchors.scrollTo}
              />
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <View style={{ flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, overflow: "hidden" }}>
            {(["cards", "table"] as const).map((value) => (
              <TouchableOpacity
                key={value}
                onPress={() => setMode(value)}
                style={{
                  minHeight: 34,
                  justifyContent: "center",
                  paddingHorizontal: spacing.md,
                  backgroundColor: mode === value ? colors.surfaceMuted : colors.surface
                }}
              >
                <Text
                  style={{
                    color: mode === value ? colors.foreground : colors.muted,
                    fontSize: 11,
                    fontWeight: "700",
                    textTransform: "uppercase"
                  }}
                >
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {contentSections.map((section) => {
        if (section.variant === "links") {
          return <CollectionLinksSection key={section.id} section={section} itemPressHandler={itemPressHandler?.(section.id)} />;
        }
        if (section.variant === "collection-items") {
          return (
            <View key={section.id} onLayout={anchors.register(section.id)}>
              <CollectionItemsSection
                section={section}
                mode={mode}
                onImagePress={(image, title) => setLightbox({ image, title })}
                loadingMore={loadingSectionId === section.id}
                onLoadMore={onLoadMore ? () => onLoadMore(section) : undefined}
              />
            </View>
          );
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
      <ImageLightbox image={lightbox?.image ?? null} title={lightbox?.title} onClose={() => setLightbox(null)} />
    </>
  );
}

const WIKI_SECTION_ORDER = [
  "overview",
  "stats",
  "game-details",
  "active-codes",
  "codes",
  "catalog",
  "controls",
  "tips",
  "events",
  "event-timeline",
  "checklists",
  "quizzes",
  "articles",
  "media",
  "game-passes",
  "badges",
  "servers",
  "developer-games",
  "social"
];

const WIKI_ANCHOR_LABELS: Record<string, string> = {
  overview: "Overview",
  "active-codes": "Codes",
  catalog: "Catalogs",
  controls: "Controls",
  tips: "Tips",
  "event-timeline": "Events",
  checklists: "Checklists",
  quizzes: "Quizzes",
  articles: "Articles",
  "developer-games": "More games"
};

export function WikiDetailView({
  detail,
  itemPressHandler,
  onOpenWeb,
  scrollRef
}: {
  detail: MobileContentDetailResponse;
  itemPressHandler?: (sectionId: string) => (item: MobileContentDetailItem) => (() => void) | null;
  onOpenWeb: () => void;
  scrollRef?: MutableRefObject<ScrollViewType | null>;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const anchors = useSectionAnchors(scrollRef);

  const orderedSections = useMemo(() => {
    const orderIndex = new Map(WIKI_SECTION_ORDER.map((id, index) => [id, index]));
    return [...detail.sections].sort((a, b) => (orderIndex.get(a.id) ?? 90) - (orderIndex.get(b.id) ?? 90));
  }, [detail.sections]);

  const anchorEntries = orderedSections
    .filter((section) => WIKI_ANCHOR_LABELS[section.id] && (section.body || section.items.length))
    .map((section) => ({ id: section.id, label: WIKI_ANCHOR_LABELS[section.id] }));

  const statsPress = detail.universeId ? () => router.push(`/stats/${detail.universeId}` as never) : undefined;

  return (
    <>
      <View style={{ gap: spacing.lg }}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.5 }}>Wiki</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.lg }}>
          {detail.coverImage ? (
            <Image
              source={{ uri: detail.coverImage }}
              style={{ width: 92, height: 92, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted }}
              resizeMode="cover"
            />
          ) : null}
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Text style={{ color: colors.foreground, fontSize: 26, lineHeight: 32, fontWeight: "800" }}>{detail.title}</Text>
            {detail.updatedAt ? <MetaText>Updated {formatUpdatedLabel(detail.updatedAt)}</MetaText> : null}
          </View>
        </View>
        {detail.robloxUrl ? (
          <Button icon="play" label="Play on Roblox" onPress={() => void Linking.openURL(detail.robloxUrl!)} />
        ) : null}
        <SectionAnchorChips entries={anchorEntries} onPress={anchors.scrollTo} />
      </View>

      {orderedSections.map((section) => {
        if (!section.body && !section.items.length) return null;
        const wrap = (node: ReactElement) => (
          <View key={section.id} onLayout={anchors.register(section.id)}>
            {node}
          </View>
        );
        if (section.variant === "markdown" && section.body) {
          if (section.id === "overview") {
            return wrap(<Markdown body={section.body} />);
          }
          return wrap(
            <View style={{ gap: spacing.md }}>
              <Text style={{ color: colors.foreground, fontSize: 21, lineHeight: 27, fontWeight: "700" }}>{section.title}</Text>
              <Markdown body={section.body} />
            </View>
          );
        }
        if (section.variant === "stats") return wrap(<WikiStatsSection section={section} onPress={statsPress} />);
        if (section.variant === "collection-details") return wrap(<DetailsGridSection section={section} />);
        if (section.variant === "timeline") return wrap(<TimelineSection section={section} />);
        if (section.variant === "social") return wrap(<SocialLinksSection section={section} />);
        if (section.variant === "codes") {
          const viewAll = section.sourceId ? () => router.push(`/codes/${encodeURIComponent(section.sourceId!)}` as never) : undefined;
          return wrap(<ActiveCodesSection section={section} onViewAll={viewAll} />);
        }
        if (section.id === "controls") return wrap(<WikiControlsSection section={section} />);
        if (section.id === "media") return wrap(<MediaGridSection section={section} />);
        if (section.id === "catalog") {
          return wrap(
            <View style={{ gap: spacing.xl }}>
              {section.items.map((item, index) => {
                const onPress = itemPressHandler ? itemPressHandler(section.id)(item) : null;
                return (
                  <View key={`${item.id}-${index}`} style={{ gap: spacing.md }}>
                    <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>{item.title}</Text>
                    {item.body ? <Markdown body={item.body} /> : null}
                    <CollectionCtaCard item={item} onPress={onPress ?? undefined} />
                  </View>
                );
              })}
            </View>
          );
        }
        return wrap(<WikiRelatedSection section={section} itemPressHandler={itemPressHandler?.(section.id)} />);
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
      {detail.coverImage ? (
        <Image
          source={{ uri: detail.coverImage }}
          style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radii.lg, backgroundColor: colors.surfaceMuted }}
          resizeMode="cover"
        />
      ) : null}
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
          <Badge label="Events" tone="accent" />
          {detail.badge && detail.badge !== "Event" ? <Badge label={detail.badge} /> : null}
        </View>
        <Text style={{ color: colors.foreground, fontSize: 26, lineHeight: 32, fontWeight: "800" }}>{detail.title}</Text>
        {detail.subtitle ? <Text style={{ color: colors.mutedStrong, fontSize: 14, fontWeight: "600" }}>{detail.subtitle}</Text> : null}
      </View>
      {timeline ? (
        <TimelineSection section={timeline} />
      ) : (
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>No scheduled events are currently available.</Text>
      )}
      <Button icon="external-link" label="Open events page on bloxodes.com" variant="secondary" onPress={onOpenWeb} />
    </>
  );
}
