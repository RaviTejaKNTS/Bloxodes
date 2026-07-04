import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useTheme } from "../../src/theme-context";

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontWeight: "800", color: colors.foreground },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size - 2} color={color} />
        }}
      />
      <Tabs.Screen
        name="codes"
        options={{
          title: "Codes",
          tabBarIcon: ({ color, size }) => <Feather name="key" size={size - 2} color={color} />
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          tabBarIcon: ({ color, size }) => <Feather name="grid" size={size - 2} color={color} />
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size - 2} color={color} />
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size - 2} color={color} />
        }}
      />
    </Tabs>
  );
}
