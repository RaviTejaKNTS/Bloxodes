import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { darkColors, lightColors, type ThemeColors } from "./theme";
import { readJson, writeJson, THEME_MODE_KEY } from "./storage";

type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  statusBarStyle: "dark" | "light";
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    let cancelled = false;
    void readJson<ThemeMode>(THEME_MODE_KEY).then((stored) => {
      if (!cancelled && (stored === "light" || stored === "dark" || stored === "system")) {
        setModeState(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isDark = mode === "system" ? systemScheme === "dark" : mode === "dark";

  const value = useMemo<ThemeContextValue>(() => {
    const setMode = (nextMode: ThemeMode) => {
      setModeState(nextMode);
      void writeJson(THEME_MODE_KEY, nextMode);
    };
    return {
      colors: isDark ? darkColors : lightColors,
      isDark,
      mode,
      statusBarStyle: isDark ? "light" : "dark",
      setMode,
      toggleTheme: () => setMode(isDark ? "light" : "dark")
    };
  }, [isDark, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
