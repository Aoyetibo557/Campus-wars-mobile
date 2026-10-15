import "../global.css";

import { useEffect } from "react";
import { View } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { setStatusBarStyle, StatusBar } from "expo-status-bar";
import { vars } from "nativewind";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { AuthProvider, useAuth } from "@/lib/auth";
import { signOut } from "@/lib/auth-api";
import { queryClient } from "@/lib/queryClient";
import { resolveRouteArea } from "@/lib/route-guards";
import { tokens } from "@/theme/tokens";

const themeVars = vars({
  "--color-background": tokens.light.background,
  "--color-surface": tokens.light.surface,
  "--color-surface-raised": tokens.light.surfaceRaised,
  "--color-text": tokens.light.text,
  "--color-text-muted": tokens.light.textMuted,
  "--color-accent": tokens.light.accent,
  "--color-success": tokens.light.success,
  "--color-danger": tokens.light.danger,
  "--color-border": tokens.light.border,
  "dark--color-background": tokens.dark.background,
  "dark--color-surface": tokens.dark.surface,
  "dark--color-surface-raised": tokens.dark.surfaceRaised,
  "dark--color-text": tokens.dark.text,
  "dark--color-text-muted": tokens.dark.textMuted,
  "dark--color-accent": tokens.dark.accent,
  "dark--color-success": tokens.dark.success,
  "dark--color-danger": tokens.dark.danger,
  "dark--color-border": tokens.dark.border,
});

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true });
setStatusBarStyle("auto");

/** Full-screen blocker when the profile can't be loaded — never a dead splash. */
function ProfileErrorScreen() {
  const { refetchProfile } = useAuth();
  return (
    <Screen contentClassName="items-center justify-center gap-4">
      <Text variant="title">Something went wrong</Text>
      <Text variant="muted" className="text-center">
        We could not load your profile. Check your connection and try again.
      </Text>
      <Button onPress={refetchProfile} className="mt-2">
        Try again
      </Button>
      <Button variant="ghost" onPress={() => void signOut()}>
        Log out
      </Button>
    </Screen>
  );
}

/**
 * Declarative route protection — see the truth table in
 * src/lib/route-guards.ts. While `splash` resolves, nothing renders under
 * the native splash (no flash of the wrong screen).
 */
function RootNavigator() {
  const {
    sessionState,
    profile,
    profileStatus,
    ready,
    recoveryInProgress,
  } = useAuth();

  const area = resolveRouteArea({
    session: sessionState,
    recoveryInProgress,
    profileStatus,
    hasSchool: profile?.university_id != null,
  });

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (area === "splash") return null;
  if (area === "retry") return <ProfileErrorScreen />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={area === "auth"}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={area === "onboarding"}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={area === "tabs"}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      {__DEV__ ? <Stack.Screen name="dev/ui-kit" /> : null}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <View className="flex-1 bg-background" style={themeVars}>
            <StatusBar style="auto" />
            <RootNavigator />
          </View>
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
