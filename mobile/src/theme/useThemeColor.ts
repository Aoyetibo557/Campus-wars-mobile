import { useColorScheme } from "nativewind";

import { tokens, type SemanticColor } from "@/theme/tokens";

/**
 * Resolve a semantic token to its hex value for props that can't take a
 * NativeWind class (ActivityIndicator color, placeholderTextColor fallback).
 * Mirrors the scheme selection in src/app/_layout.tsx.
 */
export function useThemeColor(name: SemanticColor): string {
  const scheme = useColorScheme().colorScheme === "dark" ? "dark" : "light";
  return tokens[scheme][name];
}
