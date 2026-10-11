import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

export type ScreenProps = {
  children: ReactNode;
  /** Wrap content in a ScrollView (keyboardShouldPersistTaps="handled"). */
  scroll?: boolean;
  /** Apply the standard horizontal/vertical padding. Default true. */
  padded?: boolean;
  /** Safe-area edges to respect. Default ["top", "bottom"]. */
  edges?: readonly Edge[];
  /** Offset for KeyboardAvoidingView (e.g. header height). Default 0. */
  keyboardVerticalOffset?: number;
  /** Extra classes on the outer safe-area container. */
  className?: string;
  /** Extra classes on the inner content container. */
  contentClassName?: string;
};

/**
 * Themed screen scaffold: safe area + themed background + keyboard avoidance
 * + optional scrolling + consistent padding. Auth and onboarding screens
 * use this as their outer container.
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ["top", "bottom"],
  keyboardVerticalOffset = 0,
  className,
  contentClassName,
}: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName={cn(padded && "px-6 py-4", contentClassName)}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={cn("flex-1", padded && "px-6 py-4", contentClassName)}>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} className={cn("flex-1 bg-background", className)}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
