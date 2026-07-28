import { useCallback, useEffect, useState } from "react";
import { Image, Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { fetchChecklistProgressSummary, fetchQuizProgressSummary } from "../../src/api";
import { useAuth } from "../../src/auth";
import { radii, spacing } from "../../src/theme";
import { useTheme } from "../../src/theme-context";
import { AppIcon, Badge, Button, Card, Divider, MetaText, Pill } from "../../src/components/ui";
import type { ChecklistProgressSummary, QuizProgressSummary } from "../../src/types";

function ThemeRow() {
  const { colors, mode, setMode } = useTheme();
  const options = [
    { value: "light" as const, label: "Light", icon: "sun" as const },
    { value: "dark" as const, label: "Dark", icon: "moon" as const },
    { value: "system" as const, label: "Auto", icon: "smartphone" as const }
  ];
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      {options.map((option) => {
        const active = mode === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => setMode(option.value)}
            activeOpacity={0.85}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: active ? colors.accentBorder : colors.border,
              backgroundColor: active ? colors.accentSoft : colors.surface,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm
            }}
          >
            <AppIcon name={option.icon} size={14} color={active ? colors.accent : colors.muted} />
            <Text style={{ color: active ? colors.accent : colors.mutedStrong, fontSize: 13, fontWeight: "800" }}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AccountScreen() {
  const { colors } = useTheme();
  const { user, loading, signingIn, signIn, signOut, refresh } = useAuth();
  const [checklists, setChecklists] = useState<ChecklistProgressSummary[]>([]);
  const [quizzes, setQuizzes] = useState<QuizProgressSummary[]>([]);

  const loadSummaries = useCallback(async () => {
    if (!user) {
      setChecklists([]);
      setQuizzes([]);
      return;
    }
    const [checklistSummary, quizSummary] = await Promise.all([
      fetchChecklistProgressSummary(),
      fetchQuizProgressSummary()
    ]);
    setChecklists(checklistSummary);
    setQuizzes(quizSummary);
  }, [user]);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  const displayName = user?.roblox_display_name ?? user?.display_name ?? user?.roblox_username ?? "Bloxodes user";

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <Card>
        <View style={{ gap: spacing.md, padding: spacing.xl, alignItems: "center" }}>
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 999,
              overflow: "hidden",
              backgroundColor: colors.accentSoft,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {user?.roblox_avatar_url ? (
              <Image source={{ uri: user.roblox_avatar_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <AppIcon name="user" size={30} color={colors.accent} />
            )}
          </View>
          <View style={{ alignItems: "center", gap: 3 }}>
            <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800" }}>
              {user ? displayName : "Not signed in"}
            </Text>
            {user?.roblox_username ? <MetaText>@{user.roblox_username}</MetaText> : null}
            {!user ? (
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 19 }}>
                Progress is saved on this device. Sign in with Roblox to sync codes, checklists, and quiz results with
                bloxodes.com.
              </Text>
            ) : (
              <Pill icon="refresh-cw" label="Synced with bloxodes.com" tone="accent" />
            )}
          </View>
          <View style={{ alignSelf: "stretch", gap: spacing.sm }}>
            {user ? (
              <>
                <Button label="Refresh session" icon="refresh-cw" variant="secondary" onPress={() => void refresh()} />
                <Button label="Sign out" icon="log-out" variant="ghost" onPress={() => void signOut()} />
              </>
            ) : (
              <Button
                label={signingIn ? "Opening Roblox sign-in..." : loading ? "Checking session..." : "Sign in with Roblox"}
                icon="log-in"
                onPress={() => void signIn()}
                disabled={signingIn || loading}
              />
            )}
          </View>
        </View>
      </Card>

      {user && (checklists.length || quizzes.length) ? (
        <Card>
          <View style={{ gap: 2, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800" }}>Your progress</Text>
            <MetaText>Synced from your Bloxodes account.</MetaText>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.xs }}>
            {checklists.map((entry, index) => (
              <View key={`checklist-${entry.slug}`}>
                {index > 0 ? <Divider /> : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}>
                  <AppIcon name="check-square" size={16} color={colors.accent} />
                  <Text style={{ flex: 1, color: colors.foreground, fontSize: 14, fontWeight: "700" }} numberOfLines={1}>
                    {entry.slug.replace(/-/g, " ")}
                  </Text>
                  <Badge label={`${entry.checkedCount} done`} />
                </View>
              </View>
            ))}
            {quizzes.map((entry, index) => (
              <View key={`quiz-${entry.code}`}>
                {index > 0 || checklists.length ? <Divider /> : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}>
                  <AppIcon name="help-circle" size={16} color={colors.accent} />
                  <Text style={{ flex: 1, color: colors.foreground, fontSize: 14, fontWeight: "700" }} numberOfLines={1}>
                    {entry.code.replace(/-/g, " ")}
                  </Text>
                  <Badge
                    label={entry.lastScore != null && entry.lastTotal ? `${entry.lastScore}/${entry.lastTotal}` : `${entry.seenCount} seen`}
                  />
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={{ gap: spacing.md, padding: spacing.lg }}>
          <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800" }}>Appearance</Text>
          <ThemeRow />
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.sm, padding: spacing.lg }}>
          <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800" }}>Privacy and account</Text>
          <Button
            label="Privacy policy"
            icon="shield"
            variant="secondary"
            onPress={() => void Linking.openURL("https://bloxodes.com/privacy-policy")}
          />
          <Button
            label="Terms of service"
            icon="file-text"
            variant="secondary"
            onPress={() => void Linking.openURL("https://bloxodes.com/terms-of-service")}
          />
          <Button
            label="Delete account and data"
            icon="trash-2"
            variant="ghost"
            onPress={() => void Linking.openURL("https://bloxodes.com/account-deletion")}
          />
        </View>
      </Card>
    </ScrollView>
  );
}
