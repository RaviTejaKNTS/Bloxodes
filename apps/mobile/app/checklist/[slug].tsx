import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { fetchChecklistProgress, fetchContentDetail, saveChecklistProgress } from "../../src/api";
import { useSyncedProgress } from "../../src/progress";
import { checklistProgressKey } from "../../src/storage";
import { spacing } from "../../src/theme";
import { useTheme } from "../../src/theme-context";
import { AppIcon, Badge, Button, Card, CoverImage, Divider, ErrorState, LoadingState, MetaText, ProgressBar } from "../../src/components/ui";
import type { MobileContentDetailItem, MobileContentDetailResponse, MobileContentDetailSection } from "../../src/types";

function ChecklistItemRow({
  checked,
  item,
  onToggle
}: {
  checked: boolean;
  item: MobileContentDetailItem;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.8}
      style={{ flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md, opacity: checked ? 0.62 : 1 }}
    >
      <View
        style={{
          marginTop: 1,
          width: 24,
          height: 24,
          borderRadius: 7,
          borderWidth: 1.5,
          borderColor: checked ? colors.accentDark : colors.border,
          backgroundColor: checked ? colors.accentDark : "transparent",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {checked ? <AppIcon name="check" size={14} color={colors.white} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
          <Text
            style={{
              flexShrink: 1,
              color: colors.foreground,
              fontSize: 15,
              lineHeight: 21,
              fontWeight: "600",
              textDecorationLine: checked ? "line-through" : "none"
            }}
          >
            {item.title}
          </Text>
          {item.badge ? <Badge label={item.badge} /> : null}
        </View>
        {item.body ? (
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{item.body}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function ChecklistSection({
  ids,
  onToggle,
  section
}: {
  ids: Set<string>;
  onToggle: (id: string) => void;
  section: MobileContentDetailSection;
}) {
  const { colors } = useTheme();
  if (!section.items.length) return null;
  const checkedCount = section.items.filter((item) => ids.has(item.id)).length;
  return (
    <Card>
      <View style={{ gap: 2, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
          <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800" }}>{section.title}</Text>
          <Badge label={`${checkedCount}/${section.items.length}`} tone={checkedCount === section.items.length ? "accent" : "default"} />
        </View>
        {section.subtitle ? <MetaText>{section.subtitle}</MetaText> : null}
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.xs }}>
        {section.items.map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <Divider /> : null}
            <ChecklistItemRow item={item} checked={ids.has(item.id)} onToggle={() => onToggle(item.id)} />
          </View>
        ))}
      </View>
    </Card>
  );
}

export default function ChecklistScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = typeof params.slug === "string" ? decodeURIComponent(params.slug) : "";
  const { colors } = useTheme();
  const [detail, setDetail] = useState<MobileContentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchContentDetail("checklists", slug);
      setDetail(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load checklist");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const progress = useSyncedProgress({
    storageKey: slug ? checklistProgressKey(slug) : null,
    fetchRemote: useCallback(async () => (await fetchChecklistProgress(slug)).checkedIds, [slug]),
    saveRemote: useCallback((ids: string[]) => saveChecklistProgress(slug, ids), [slug])
  });

  const taskSections = useMemo(
    () => (detail?.sections ?? []).filter((section) => section.items.length && section.id !== "overview"),
    [detail]
  );
  const totalTasks = useMemo(
    () => taskSections.reduce((sum, section) => sum + section.items.length, 0),
    [taskSections]
  );
  const checkedTasks = useMemo(
    () => taskSections.reduce((sum, section) => sum + section.items.filter((item) => progress.ids.has(item.id)).length, 0),
    [taskSections, progress.ids]
  );
  const overview = detail?.sections.find((section) => section.id === "overview");

  return (
    <>
      <Stack.Screen options={{ title: detail?.title ?? "Checklist" }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }}
      >
        {loading ? <LoadingState label="Loading checklist" /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        {detail ? (
          <>
            <Card>
              <CoverImage source={detail.coverImage} label={detail.title} />
              <View style={{ gap: spacing.sm, padding: spacing.lg }}>
                {detail.badge ? <Badge label={detail.badge} tone="accent" /> : null}
                <Text style={{ color: colors.foreground, fontSize: 22, lineHeight: 28, fontWeight: "800" }}>{detail.title}</Text>
                {detail.subtitle ? <MetaText>{detail.subtitle}</MetaText> : null}
                {overview?.body ? (
                  <Text style={{ color: colors.mutedStrong, fontSize: 14.5, lineHeight: 21 }}>{overview.body}</Text>
                ) : null}
                <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <MetaText>
                      {checkedTasks} of {totalTasks} tasks done
                    </MetaText>
                    <MetaText>{totalTasks ? Math.round((checkedTasks / totalTasks) * 100) : 0}%</MetaText>
                  </View>
                  <ProgressBar progress={totalTasks ? checkedTasks / totalTasks : 0} />
                </View>
              </View>
            </Card>

            {taskSections.map((section) => (
              <ChecklistSection key={section.id} section={section} ids={progress.ids} onToggle={progress.toggle} />
            ))}

            <Button
              icon="external-link"
              label="Open on bloxodes.com"
              variant="secondary"
              onPress={() => void Linking.openURL(detail.url)}
            />
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
