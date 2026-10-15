import { useState } from "react";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { signOut } from "@/lib/auth-api";

export default function ProfileScreen() {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await signOut();
    // SIGNED_OUT clears the query cache and the guard returns to (auth).
  }

  return (
    <Screen contentClassName="flex-1 justify-between">
      <View className="flex-1 items-center justify-center">
        <Text variant="heading">Profile</Text>
        <Text variant="muted" className="mt-2 text-center">
          Your stats, history, and settings will live here.
        </Text>
      </View>
      <Button
        variant="secondary"
        loading={pending}
        onPress={handleSignOut}
        className="mb-2"
      >
        Log out
      </Button>
    </Screen>
  );
}
