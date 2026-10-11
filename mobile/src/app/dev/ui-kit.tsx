import { useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";

import { Screen } from "@/components/Screen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, type ButtonVariant, type ButtonSize } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text, type TextVariant } from "@/components/ui/text";

const TEXT_VARIANTS: TextVariant[] = [
  "default",
  "heading",
  "title",
  "body",
  "caption",
  "label",
  "muted",
  "accent",
  "success",
  "danger",
];

const BUTTON_VARIANTS: ButtonVariant[] = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
];

const BUTTON_SIZES: ButtonSize[] = ["default", "sm", "lg", "icon"];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-3">
      <Text variant="caption" className="font-semibold uppercase tracking-wide">
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Dev-only component showcase. In production builds this redirects home —
 * the route exists in the bundle but is unreachable.
 */
export default function UIKitScreen() {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <Screen scroll contentClassName="gap-8 pb-12">
      <Section title="Text">
        {TEXT_VARIANTS.map((variant) => (
          <View key={variant} className="flex-row items-baseline gap-3">
            <Text variant="caption" className="w-16">
              {variant}
            </Text>
            <Text variant={variant}>Campus Wars</Text>
          </View>
        ))}
      </Section>

      <Section title="Button × variant">
        {BUTTON_VARIANTS.map((variant) => (
          <View key={variant} className="flex-row items-center gap-3">
            <Text variant="caption" className="w-20">
              {variant}
            </Text>
            <Button variant={variant} size="sm">
              Label
            </Button>
            <Button variant={variant} size="sm" disabled>
              Disabled
            </Button>
            <Button variant={variant} size="sm" loading>
              Loading
            </Button>
          </View>
        ))}
      </Section>

      <Section title="Button × size">
        {BUTTON_SIZES.map((size) => (
          <View key={size} className="flex-row items-center gap-3">
            <Text variant="caption" className="w-16">
              {size}
            </Text>
            <Button size={size}>{size === "icon" ? "+" : "Button"}</Button>
          </View>
        ))}
      </Section>

      <Section title="Input">
        <View className="gap-2">
          <Label nativeID="demo-input-label">Default (tap to focus)</Label>
          <Input
            nativeID="demo-input"
            placeholder="you@university.edu"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        <View className="gap-2">
          <Label>Error</Label>
          <Input error defaultValue="bad input" />
        </View>
      </Section>

      <Section title="AlertDialog">
        <Button onPress={() => setDialogOpen(true)}>Open dialog</Button>
      </Section>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm your school</AlertDialogTitle>
            <AlertDialogDescription>
              Your school cannot be changed after onboarding. This choice is
              permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onPress={() => setDialogOpen(false)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Screen>
  );
}
