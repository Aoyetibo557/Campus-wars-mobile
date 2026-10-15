import { View } from "react-native";
import { useRouter } from "expo-router";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <Screen contentClassName="justify-center gap-8">
      <View className="gap-3">
        <Text variant="heading">Campus Wars</Text>
        <Text variant="muted">
          Play daily mini-games, earn points for your school, and climb the
          leaderboard. Your campus is counting on you.
        </Text>
      </View>
      <View className="gap-3">
        <Button onPress={() => router.push("/sign-up")}>Create account</Button>
        <Button variant="secondary" onPress={() => router.push("/log-in")}>
          Log in
        </Button>
      </View>
    </Screen>
  );
}
