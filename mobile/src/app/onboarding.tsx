import { useRef, useState } from "react";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth";
import { signOut } from "@/lib/auth-api";
import {
  mapOnboardingError,
  useCompleteOnboarding,
  useMyUniversity,
} from "@/lib/profile";

const MIN = 2;
const MAX = 20;

/** Code points, not string length — a ZWJ emoji sequence counts as its
 *  visual parts (same chars the DB's char_length sees). No maxLength on
 *  the input: users see the counter, the check runs on submit. */
const codePoints = (s: string) => Array.from(s.trim()).length;

export default function OnboardingScreen() {
  const { profile, refetchProfile } = useAuth();
  const university = useMyUniversity(profile?.university_id);
  const complete = useCompleteOnboarding();

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState(false);
  const submittingRef = useRef(false);

  const count = codePoints(name);
  const schoolName =
    university.data?.short_name ?? university.data?.name ?? null;

  async function submit() {
    if (submittingRef.current) return;
    const len = count;
    const err =
      len < MIN || len > MAX ? `Name must be ${MIN}–${MAX} characters.` : null;
    setNameError(err);
    if (err) return;

    submittingRef.current = true;
    try {
      await complete.mutateAsync(name);
      // Celebration persists until the CTA — the profile refetch (and
      // the guard's move to tabs) only happens on the Home tap.
      setDone(true);
    } catch (e) {
      setNameError(mapOnboardingError(e));
    } finally {
      submittingRef.current = false;
    }
  }

  async function goHome() {
    setLeaving(true);
    setLeaveError(false);
    try {
      await refetchProfile();
    } catch {
      setLeaveError(true);
    } finally {
      setLeaving(false);
    }
  }

  if (done) {
    return (
      <Screen contentClassName="items-center justify-center gap-6">
        <View className="items-center gap-3">
          <Text variant="heading" className="text-center">
            {'You\'re in!'}
          </Text>
          <Text variant="muted" className="text-center">
            {schoolName
              ? `Time to put ${schoolName} on the leaderboard.`
              : "Time to put your school on the leaderboard."}
          </Text>
        </View>
        {leaveError && (
          <Text variant="danger" className="text-center">
            {
              "Couldn't load your profile. Check your connection and try again."
            }
          </Text>
        )}
        <Button onPress={goHome} loading={leaving} testID="onboarding-home">
          Go to Home
        </Button>
        <Button
          variant="ghost"
          testID="onboarding-logout"
          onPress={() => void signOut()}
        >
          Log out
        </Button>
      </Screen>
    );
  }

  return (
    <Screen scroll contentClassName="gap-6">
      <View className="gap-2 pt-6">
        <Text variant="heading">
          {schoolName ? `Welcome to ${schoolName}!` : "One last thing"}
        </Text>
        <Text variant="muted">
          {
            "Pick a display name. It's what other students see on the leaderboard."
          }
        </Text>
      </View>

      <View className="gap-2">
        <View className="flex-row items-baseline justify-between">
          <Label nativeID="name-label">Display name</Label>
          <Text variant="muted" className="text-xs" testID="name-counter">
            {count}/{MAX}
          </Text>
        </View>
        <Input
          nativeID="display-name"
          aria-labelledby="name-label"
          testID="display-name"
          placeholder="e.g. QuizMaster3000"
          value={name}
          onChangeText={setName}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
          error={!!nameError}
          editable={!complete.isPending}
        />
        {nameError && <Text variant="danger">{nameError}</Text>}
      </View>

      <Button
        testID="onboarding-submit"
        onPress={submit}
        loading={complete.isPending}
      >
        Continue
      </Button>

      <Button
        variant="ghost"
        testID="onboarding-logout"
        onPress={() => void signOut()}
      >
        Log out
      </Button>
    </Screen>
  );
}
