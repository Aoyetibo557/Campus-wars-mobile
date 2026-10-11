import "../global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { vars, useColorScheme } from "nativewind";
import { View } from "react-native";

import { queryClient } from "@/lib/queryClient";
import { themeVars } from "@/theme/tokens";

export default function RootLayout() {
  const scheme = useColorScheme().colorScheme === "dark" ? "dark" : "light";

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        {/* Injects the semantic color tokens as CSS vars for NativeWind */}
        <View style={vars(themeVars(scheme))} className="flex-1 bg-background">
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </View>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
