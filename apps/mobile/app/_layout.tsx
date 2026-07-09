import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/auth";
import { ThemeProvider, useTheme } from "../src/theme-context";

function ThemedStack() {
  const { colors, statusBarStyle } = useTheme();
  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontWeight: "800", color: colors.foreground },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background }
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="codes/[slug]" options={{ title: "Codes" }} />
        <Stack.Screen name="collections/[slug]" options={{ title: "Collection" }} />
        <Stack.Screen name="section/[kind]/index" options={{ title: "Browse" }} />
        <Stack.Screen name="section/[kind]/[slug]" options={{ title: "" }} />
        <Stack.Screen name="quiz/[code]" options={{ title: "Quiz" }} />
        <Stack.Screen name="checklist/[slug]" options={{ title: "Checklist" }} />
        <Stack.Screen name="stats/[universeId]" options={{ title: "Game stats" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ThemedStack />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
