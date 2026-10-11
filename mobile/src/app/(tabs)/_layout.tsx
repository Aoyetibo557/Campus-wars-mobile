import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useColorScheme } from "nativewind";

import { tokens } from "@/theme/tokens";

const TAB_ICONS = {
  index: "home",
  games: "game-controller",
  leaderboard: "trophy",
  profile: "person",
} as const;

export default function TabLayout() {
  const scheme = useColorScheme().colorScheme === "dark" ? "dark" : "light";
  const theme = tokens[scheme];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_ICONS.index} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: "Games",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_ICONS.games} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Leaderboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_ICONS.leaderboard} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_ICONS.profile} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
