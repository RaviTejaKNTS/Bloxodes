import * as Clipboard from "expo-clipboard";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { fetchCodeDetail, fetchCodeProgress, saveCodeProgress } from "../../src/api";
import { formatDate, rewardText, stripMarkdown } from "../../src/format";
import { useSyncedProgress } from "../../src/progress";
import { codeProgressKey } from "../../src/storage";
import { radii, spacing } from "../../src/theme";
import { useTheme } from "../../src/theme-context";
import { AppIcon, Badge, Button, Card, CoverImage, Divider, EmptyState, ErrorState, LoadingState, MetaText, Pill } from "../../src/components/ui";
import type { CodeDetailResponse, CodeItem } from "../../src/types";

function CodeRow({
  code,
  copied,
  onCopy,
  onToggleUsed,
  used
}: {
  code: CodeItem;
  copied: boolean;
  onCopy: () => void;
  onToggleUsed: () => void;
  used: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, opacity: used ? 0.6 : 1 }}>
      <TouchableOpacity
        onPress={onToggleUsed}
        activeOpacity={0.8}
        hitSlop={8}
        accessibilityLabel={used ? `Mark ${code.code} as unused` : `Mark ${code.code} as used`}
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          borderWidth: 1.5,
          borderColor: used ? colors.accentDark : colors.border,
          backgroundColor: used ? colors.accentDark : "transparent",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {used ? <AppIcon name="check" size={14} color={colors.white} /> : null}
      </TouchableOpacity>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
          <Text
            style={{
              color: used ? colors.muted : colors.foreground,
              fontSize: 16,
              fontWeight: "900",
              letterSpacing: 0.8,
              textDecorationLine: used ? "line-through" : "none"
            }}
          >
            {code.code}
          </Text>
          {code.isNew ? <Badge label="New" tone="accent" /> : null}
          {code.levelRequirement != null ? <Badge label={`Level ${code.levelRequirement}+`} /> : null}
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
          {rewardText(code.rewardText)}
        </Text>
        <MetaText>Added {formatDate(code.firstSeenAt)}</MetaText>
      </View>
      <TouchableOpacity
        onPress={onCopy}
        activeOpacity={0.85}
        style={{
          minHeight: 36,
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
        <Text style={{ color: copied ? colors.white : colors.accent, fontSize: 12, fontWeight: "900" }}>
          {copied ? "Copied" : "Copy"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CodeDetailScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const { colors } = useTheme();
  const [detail, setDetail] = useState<CodeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCodeDetail(slug);
      setDetail(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load code page");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const progress = useSyncedProgress({
    storageKey: slug ? codeProgressKey(slug) : null,
    fetchRemote: useCallback(async () => (await fetchCodeProgress(slug)).usedCodes, [slug]),
    saveRemote: useCallback((ids: string[]) => saveCodeProgress(slug, ids), [slug])
  });

  const activeCodes = detail?.activeCodes ?? [];
  const expiredCodes = detail?.expiredCodes ?? [];
  const usedCount = useMemo(
    () => activeCodes.filter((code) => progress.ids.has(code.code)).length,
    [activeCodes, progress.ids]
  );

  async function copyCode(code: string) {
    await Clipboard.setStringAsync(code);
    setCopiedCode(code);
    progress.add(code);
    setTimeout(() => setCopiedCode(null), 1600);
  }

  return (
    <>
      <Stack.Screen options={{ title: detail ? `${detail.game.name} Codes` : "Codes" }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }}
      >
        {loading ? <LoadingState label="Loading codes" /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        {detail ? (
          <>
            <Card>
              <CoverImage source={detail.game.coverImage} label={detail.game.name} />
              <View style={{ gap: spacing.sm, padding: spacing.lg }}>
                <Text style={{ color: colors.foreground, fontSize: 22, lineHeight: 28, fontWeight: "800" }}>
                  {detail.game.name} Codes
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  <Pill icon="key" label={`${activeCodes.length} active`} tone="accent" />
                  <Pill icon="check-circle" label={`${usedCount} used`} />
                  <Pill icon="clock" label={`Updated ${formatDate(detail.game.contentUpdatedAt)}`} />
                </View>
                {stripMarkdown(detail.game.description) ? (
                  <Text style={{ color: colors.mutedStrong, fontSize: 14.5, lineHeight: 21 }}>
                    {stripMarkdown(detail.game.description)}
                  </Text>
                ) : null}
              </View>
            </Card>

            <Card>
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, gap: 2 }}>
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800" }}>Active codes</Text>
                <MetaText>Tap the checkbox to track codes you have already redeemed.</MetaText>
              </View>
              <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
                {activeCodes.length === 0 ? (
                  <EmptyState
                    title="No active codes right now"
                    body="We have not confirmed any working codes at the moment. Check back soon for the next drop."
                  />
                ) : (
                  activeCodes.map((code, index) => (
                    <View key={code.id}>
                      {index > 0 ? <Divider /> : null}
                      <CodeRow
                        code={code}
                        copied={copiedCode === code.code}
                        used={progress.ids.has(code.code)}
                        onCopy={() => void copyCode(code.code)}
                        onToggleUsed={() => progress.toggle(code.code)}
                      />
                    </View>
                  ))
                )}
              </View>
            </Card>

            <Card>
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, gap: 2 }}>
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800" }}>Expired codes</Text>
                <MetaText>These no longer work, but they help avoid retrying old codes.</MetaText>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, padding: spacing.lg, paddingTop: spacing.sm }}>
                {expiredCodes.length === 0 ? (
                  <MetaText>No expired codes tracked yet.</MetaText>
                ) : (
                  expiredCodes.slice(0, 80).map((code) => (
                    <View
                      key={code.id}
                      style={{
                        borderRadius: radii.sm,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceMuted,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs
                      }}
                    >
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{code.code}</Text>
                    </View>
                  ))
                )}
              </View>
            </Card>

            {detail.game.robloxUrl ? (
              <Button
                icon="external-link"
                label="Open Roblox game"
                variant="secondary"
                onPress={() => void Linking.openURL(detail.game.robloxUrl!)}
              />
            ) : null}
            <Button
              icon="external-link"
              label="View full codes page on bloxodes.com"
              variant="secondary"
              onPress={() => void Linking.openURL(detail.game.url)}
            />
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
