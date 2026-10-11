/**
 * Semantic design tokens for the app.
 *
 * TODO(provisional O1): every hex value below is a PLACEHOLDER picked to sketch
 * the "soft black and cream" direction from decisions.md D1. O1 (exact hex
 * values + light/dark mapping) is still open — replace these once confirmed and
 * check accent/success/danger contrast on both backgrounds.
 *
 * These map to the tailwind.config.js colors via CSS variables injected at the
 * app root with NativeWind's vars() (see src/app/_layout.tsx). Components must
 * use the semantic class names (bg-surface, text-text-muted, ...) — never hex.
 */

export type SemanticColor =
  | "background"
  | "surface"
  | "surfaceRaised"
  | "border"
  | "text"
  | "textMuted"
  | "accent"
  | "success"
  | "danger"
  | "rank1"
  | "rank2"
  | "rank3";

export type ThemeScheme = "light" | "dark";

export const tokens: Record<ThemeScheme, Record<SemanticColor, string>> = {
  light: {
    // cream base, soft black text
    background: "#FAF6EA",
    surface: "#F1EBDC",
    surfaceRaised: "#FFFFFF",
    border: "#E0D8C4",
    text: "#232019",
    textMuted: "#6E6656",
    accent: "#A46B33",
    success: "#2F7D4E",
    danger: "#B4483C",
    rank1: "#A97F1F",
    rank2: "#7C776C",
    rank3: "#96714C",
  },
  dark: {
    // soft black base, cream text
    background: "#1C1B19",
    surface: "#26241F",
    surfaceRaised: "#2F2C26",
    border: "#3D3A32",
    text: "#F4EFE4",
    textMuted: "#A89F8E",
    accent: "#D9A468",
    success: "#7FB98E",
    danger: "#E08E7F",
    rank1: "#E3B35F",
    rank2: "#A9A79F",
    rank3: "#B08B66",
  },
};

const VAR_NAME: Record<SemanticColor, `--color-${string}`> = {
  background: "--color-background",
  surface: "--color-surface",
  surfaceRaised: "--color-surface-raised",
  border: "--color-border",
  text: "--color-text",
  textMuted: "--color-text-muted",
  accent: "--color-accent",
  success: "--color-success",
  danger: "--color-danger",
  rank1: "--color-rank-1",
  rank2: "--color-rank-2",
  rank3: "--color-rank-3",
};

/** "#RRGGBB" -> "R G B" channel string for `rgb(var(--x) / <alpha-value>)` */
function hexToChannels(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Build the NativeWind `vars()` object for a scheme. */
export function themeVars(
  scheme: ThemeScheme,
): Record<`--color-${string}`, string> {
  const theme = tokens[scheme];
  const entries = Object.keys(theme).map((key) => {
    const semantic = key as SemanticColor;
    return [VAR_NAME[semantic], hexToChannels(theme[semantic])] as const;
  });
  return Object.fromEntries(entries);
}
