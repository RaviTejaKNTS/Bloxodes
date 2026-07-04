import { Image, Text, TouchableOpacity, View } from "react-native";
import { radii, spacing } from "../theme";
import { useTheme } from "../theme-context";
import { formatUpdatedLabel } from "../format";
import type { MobileContentDetailItem, MobileContentDetailSection, MobileContentItem } from "../types";
import { AppIcon, Badge, Card, CoverImage, Divider, MetaText } from "./ui";

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
