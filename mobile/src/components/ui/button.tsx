import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from "react-native";
import { type ReactNode } from "react";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColor } from "@/theme/useThemeColor";

export type ButtonVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";

export type ButtonSize = "default" | "sm" | "lg" | "icon";

export type ButtonProps = Omit<PressableProps, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, blocks presses, and exposes `busy` to screen readers. */
  loading?: boolean;
  className?: string;
  children?: ReactNode;
};

const containerVariant: Record<ButtonVariant, string> = {
  default: "bg-accent",
  secondary: "bg-surface-raised border border-border",
  outline: "border border-border bg-transparent",
  ghost: "bg-transparent",
  destructive: "bg-danger",
};

const labelVariant: Record<ButtonVariant, string> = {
  default: "text-background",
  secondary: "text-text",
  outline: "text-text",
  ghost: "text-accent",
  destructive: "text-background",
};

// Every size is >= 44pt tall/wide (Apple's minimum touch target).
const sizeClasses: Record<ButtonSize, string> = {
  default: "h-12 px-5",
  sm: "h-11 px-4",
  lg: "h-14 px-6",
  icon: "h-12 w-12",
};

export function Button({
  variant = "default",
  size = "default",
  loading = false,
  disabled = false,
  className,
  onPress,
  children,
  ...props
}: ButtonProps) {
  const blocked = disabled || loading;
  const spinnerColor = useThemeColor(
    variant === "default" || variant === "destructive" ? "background" : "text",
  );

  const content =
    typeof children === "string" || typeof children === "number" ? (
      <Text className={cn("text-base font-semibold", labelVariant[variant])}>
        {children}
      </Text>
    ) : (
      children
    );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={blocked ? undefined : onPress}
      className={cn(
        "flex-row items-center justify-center rounded-xl",
        containerVariant[variant],
        sizeClasses[size],
        blocked && "opacity-50",
        className,
      )}
      {...props}
    >
      {/* Label stays mounted while loading so the width doesn't jump;
          the spinner overlays it absolutely centered. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden={loading}
        importantForAccessibility={loading ? "no-hide-descendants" : "auto"}
        style={loading && styles.hiddenContent}
      >
        {content}
      </View>
      {loading && (
        <ActivityIndicator
          style={StyleSheet.absoluteFill}
          color={spinnerColor}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hiddenContent: { opacity: 0 },
});
