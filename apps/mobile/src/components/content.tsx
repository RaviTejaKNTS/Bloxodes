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

function ProseBlock({ body }: { body: string }) {
  const { colors } = useTheme();
  const paragraphs = body.split(/\n{2,}/).map((entry) => entry.trim()).filter(Boolean);
  return (
    <View style={{ gap: spacing.md }}>
      {paragraphs.map((paragraph, index) => (
        <Text key={`${paragraph.slice(0, 24)}-${index}`} style={{ color: colors.mutedStrong, fontSize: 15, lineHeight: 23 }}>
          {paragraph}
        </Text>
      ))}
    </View>
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

function CollectionItemsSection({ section }: { section: MobileContentDetailSection }) {
  const { colors } = useTheme();
  if (!section.items.length) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: 3 }}>
        <Text style={{ color: colors.foreground, fontSize: 20, lineHeight: 25, fontWeight: "800" }}>{section.title}</Text>
        {section.subtitle ? <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>{section.subtitle}</Text> : null}
      </View>
      <View style={{ gap: spacing.lg }}>
        {section.items.map((item, index) => (
          <CollectionItemCard key={`${item.id}-${index}`} item={item} />
        ))}
      </View>
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

export function CollectionDetailView({
  detail,
  itemPressHandler,
  onOpenWeb
}: {
  detail: MobileContentDetailResponse;
  itemPressHandler?: (sectionId: string) => (item: MobileContentDetailItem) => (() => void) | null;
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
          return <CollectionItemsSection key={section.id} section={section} />;
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
