import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from "react-native";
import { radii, spacing } from "../theme";
import { useTheme } from "../theme-context";

export type FeatherIconName = keyof typeof Feather.glyphMap;

export function AppIcon({ color, name, size = 18 }: { color: string; name: FeatherIconName; size?: number }) {
  return <Feather name={name} size={size} color={color} />;
}

export function Card({
  children,
  onPress,
  style
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const base: ViewStyle = {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden"
  };
  if (onPress) {
    return (
      <TouchableOpacity style={[base, style]} onPress={onPress} activeOpacity={0.85}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Pill({
  icon,
  label,
  tone = "default"
}: {
  icon?: FeatherIconName;
  label: string;
  tone?: "default" | "accent" | "danger";
}) {
  const { colors } = useTheme();
  const background = tone === "accent" ? colors.accentSoft : colors.surfaceMuted;
  const borderColor = tone === "accent" ? colors.accentBorder : colors.border;
  const textColor = tone === "accent" ? colors.accent : tone === "danger" ? colors.danger : colors.mutedStrong;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor,
        backgroundColor: background,
        paddingHorizontal: spacing.md,
        paddingVertical: 5
      }}
    >
      {icon ? <AppIcon name={icon} size={12} color={textColor} /> : null}
      <Text style={{ color: textColor, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function Badge({ label, tone = "default" }: { label: string; tone?: "default" | "accent" | "success" }) {
  const { colors } = useTheme();
  const background = tone === "default" ? colors.surfaceMuted : colors.accentSoft;
  const textColor = tone === "default" ? colors.mutedStrong : colors.accent;
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: radii.sm,
        backgroundColor: background,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3
      }}
    >
      <Text style={{ color: textColor, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>{label}</Text>
    </View>
  );
}

export function Button({
  disabled,
  icon,
  label,
  onPress,
  variant = "primary"
}: {
  disabled?: boolean;
  icon?: FeatherIconName;
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const { colors, isDark } = useTheme();
  const container: ViewStyle = {
    minHeight: 46,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    opacity: disabled ? 0.5 : 1
  };
  const text: TextStyle = { fontSize: 14, fontWeight: "700" };

  if (variant === "primary") {
    container.backgroundColor = colors.accentDark;
    text.color = colors.white;
  } else if (variant === "secondary") {
    container.backgroundColor = colors.surface;
    container.borderWidth = 1;
    container.borderColor = colors.border;
    text.color = colors.foreground;
  } else {
    container.backgroundColor = "transparent";
    text.color = isDark ? colors.accent : colors.accentDark;
  }

  return (
    <TouchableOpacity style={container} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      {icon ? <AppIcon name={icon} size={16} color={text.color as string} /> : null}
      <Text style={text}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SectionHeader({
  action,
  onAction,
  subtitle,
  title
}: {
  action?: string;
  onAction?: () => void;
  subtitle?: string | null;
  title: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>{title}</Text>
        {subtitle ? <Text style={{ color: colors.muted, fontSize: 13 }}>{subtitle}</Text> : null}
      </View>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "700" }}>{action}</Text>
          <AppIcon name="chevron-right" size={14} color={colors.accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function CoverImage({
  aspectRatio = 16 / 9,
  label,
  source,
  style
}: {
  aspectRatio?: number;
  label: string;
  source: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  if (!source) {
    return (
      <View
        style={[
          {
            width: "100%",
            aspectRatio,
            backgroundColor: colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center"
          },
          style
        ]}
      >
        <Text style={{ color: colors.muted, fontSize: 30, fontWeight: "700" }}>{label.slice(0, 1).toUpperCase()}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: source }}
      resizeMode="cover"
      style={[{ width: "100%", aspectRatio, backgroundColor: colors.surfaceMuted }, style as StyleProp<ImageStyle>]}
    />
  );
}

export function SearchBar({
  onChangeText,
  onSubmit,
  placeholder,
  value
}: {
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        minHeight: 46,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md
      }}
    >
      <AppIcon name="search" color={colors.muted} size={16} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={{ flex: 1, minWidth: 0, color: colors.foreground, fontSize: 15, paddingVertical: spacing.sm }}
        inputMode="search"
        returnKeyType="search"
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText("")} activeOpacity={0.8} hitSlop={8}>
          <AppIcon name="x" color={colors.muted} size={16} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function LoadingState({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: spacing.md, padding: spacing.xxl }}>
      <ActivityIndicator color={colors.accent} />
      <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: spacing.md, padding: spacing.xxl }}>
      <AppIcon name="cloud-off" size={28} color={colors.muted} />
      <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>Bloxodes did not respond</Text>
      <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>{message}</Text>
      {onRetry ? <Button label="Try again" onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

export function EmptyState({ body, title }: { body?: string; title: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: spacing.sm, padding: spacing.xxl }}>
      <AppIcon name="inbox" size={26} color={colors.muted} />
      <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>{title}</Text>
      {body ? <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>{body}</Text> : null}
    </View>
  );
}

export function ProgressBar({ progress }: { progress: number }) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: "hidden" }}>
      <View
        style={{
          width: `${Math.round(clamped * 100)}%`,
          height: "100%",
          borderRadius: 999,
          backgroundColor: colors.accentDark
        }}
      />
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function MetaText({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.muted, fontSize: 12, fontWeight: "600" }, style]}>{children}</Text>;
}
