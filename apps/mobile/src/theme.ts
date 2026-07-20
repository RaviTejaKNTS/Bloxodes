export type ThemeColors = {
  background: string;
  sidebar: string;
  surface: string;
  surfaceMuted: string;
  foreground: string;
  muted: string;
  mutedStrong: string;
  border: string;
  borderMuted: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentDark: string;
  scrim: string;
  white: string;
  danger: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  dangerSoft: string;
};

export const lightColors: ThemeColors = {
  background: "#f8fafc",
  sidebar: "#f8fafc",
  surface: "#ffffff",
  surfaceMuted: "#f1f5f9",
  foreground: "#111827",
  muted: "#64748b",
  mutedStrong: "#475569",
  border: "#e2e8f0",
  borderMuted: "#edf2f7",
  accent: "#4f46e5",
  accentSoft: "rgba(79, 70, 229, 0.1)",
  accentBorder: "rgba(79, 70, 229, 0.28)",
  accentDark: "#4338ca",
  scrim: "rgba(15, 23, 42, 0.32)",
  white: "#ffffff",
  danger: "#b42318",
  success: "#047857",
  successSoft: "rgba(16, 185, 129, 0.12)",
  warning: "#b45309",
  warningSoft: "rgba(217, 119, 6, 0.12)",
  info: "#0369a1",
  infoSoft: "rgba(14, 165, 233, 0.12)",
  dangerSoft: "rgba(180, 35, 24, 0.1)"
};

export const darkColors: ThemeColors = {
  background: "#09090b",
  sidebar: "#0f1117",
  surface: "#111318",
  surfaceMuted: "#1b1f2a",
  foreground: "#f8fafc",
  muted: "#9ca3af",
  mutedStrong: "#cbd5e1",
  border: "#262b36",
  borderMuted: "#1f2430",
  accent: "#a5b4fc",
  accentSoft: "rgba(165, 180, 252, 0.14)",
  accentBorder: "rgba(165, 180, 252, 0.34)",
  accentDark: "#6366f1",
  scrim: "rgba(0, 0, 0, 0.58)",
  white: "#ffffff",
  danger: "#fca5a5",
  success: "#34d399",
  successSoft: "rgba(52, 211, 153, 0.14)",
  warning: "#fbbf24",
  warningSoft: "rgba(251, 191, 36, 0.14)",
  info: "#38bdf8",
  infoSoft: "rgba(56, 189, 248, 0.14)",
  dangerSoft: "rgba(252, 165, 165, 0.14)"
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};

export const radii = {
  sm: 6,
  md: 8,
  lg: 12
};
