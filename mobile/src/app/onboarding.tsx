import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { signOut } from "@/lib/auth-api";

/** Placeholder — real school selection is the next milestone. */
export default function OnboardingScreen() {
  return (
    <Screen contentClassName="items-center justify-center gap-4">
      <Text variant="heading">Pick your school</Text>
      <Text variant="muted" className="text-center">
        School selection lands in the next milestone. This screen exists so
        routing works end to end.
      </Text>
      <Button
        variant="secondary"
        onPress={() => void signOut()}
        className="mt-4"
      >
        Log out
      </Button>
    </Screen>
  );
}
