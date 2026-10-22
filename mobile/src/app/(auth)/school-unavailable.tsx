import { View } from "react-native";
import { useRouter } from "expo-router";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

/**
 * "My school isn't listed" stub (decisions O17 — waitlist mechanics are an
 * open decision; no backend yet).
 */
export default function SchoolUnavailableScreen() {
  const router = useRouter();
  return (
    <Screen contentClassName="justify-center gap-6">
      <View className="gap-3">
        <Text variant="heading">School not listed?</Text>
        <Text variant="muted">
          {
            "Campus Wars is rolling out school by school. Yours isn't available yet — check back soon, or log in if you already have an account."
          }
        </Text>
      </View>
      <View className="gap-3">
        <Button variant="secondary" onPress={() => router.back()}>
          Back to search
        </Button>
        <Button variant="ghost" onPress={() => router.replace("/log-in")}>
          Already have an account? Log in
        </Button>
      </View>
    </Screen>
  );
}
