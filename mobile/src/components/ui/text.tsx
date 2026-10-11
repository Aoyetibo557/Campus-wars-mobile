import { Text as RNText, type TextProps } from "react-native";

import { cn } from "@/lib/utils";

export type TextVariant =
  | "default"
  | "heading"
  | "title"
  | "body"
  | "caption"
  | "label"
  | "muted"
  | "accent"
  | "success"
  | "danger";

const variantClasses: Record<TextVariant, string> = {
  default: "text-base text-text",
  heading: "text-3xl font-black text-text",
  title: "text-xl font-bold text-text",
  body: "text-base text-text",
  caption: "text-sm text-text-muted",
  label: "text-sm font-medium text-text",
  muted: "text-base text-text-muted",
  accent: "text-base font-semibold text-accent",
  success: "text-base font-semibold text-success",
  danger: "text-base font-semibold text-danger",
};

export type ThemedTextProps = TextProps & {
  variant?: TextVariant;
  className?: string;
};

export function Text({
  variant = "default",
  className,
  ...props
}: ThemedTextProps) {
  return (
    <RNText className={cn(variantClasses[variant], className)} {...props} />
  );
}
