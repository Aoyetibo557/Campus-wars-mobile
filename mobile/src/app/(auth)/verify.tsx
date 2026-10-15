import { useCallback, useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { CodeInput } from "@/components/CodeInput";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import {
  RESEND_COOLDOWN_SECONDS,
  resendSignupCode,
  verifyCode,
} from "@/lib/auth-api";
import { mapAuthError } from "@/lib/auth-errors";
import { isCompleteCode } from "@/lib/validation";

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const codeRef = useRef<TextInput>(null);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const cooldownActive = cooldown > 0;
  useEffect(() => {
    if (!cooldownActive) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldownActive]);

  const submit = useCallback(
    async (value: string) => {
      // Block double submits and never auto-resubmit a failed code —
      // on failure the field clears, so the next auto-submit needs
      // fresh user input.
      if (verifying || !isCompleteCode(value)) return;
      setVerifying(true);
      setError(null);
      const { error: err } = await verifyCode(email, value, "signup");
      setVerifying(false);
      if (err) {
        setCode("");
        setError(mapAuthError(err));
        codeRef.current?.focus();
        return;
      }
      // Success → session lands via onAuthStateChange and the route
      // guard moves us onward.
    },
    [email, verifying],
  );

  const resend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    const { error: err } = await resendSignupCode(email);
    setResending(false);
    if (err) {
      setError(mapAuthError(err));
    } else {
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  return (
    <Screen scroll contentClassName="gap-6">
      <View className="gap-2 pt-6">
        <Text variant="heading">Check your email</Text>
        <Text variant="muted">
          We sent a 6-digit code to {email}. Enter it to verify your
          account.
        </Text>
      </View>

      <View className="gap-2">
        <Label nativeID="code-label">Verification code</Label>
        <CodeInput
          ref={codeRef}
          nativeID="verify-code"
          testID="verify-code"
          value={code}
          onChangeCode={setCode}
          onComplete={submit}
          error={!!error}
          editable={!verifying}
        />
        {error && <Text variant="danger">{error}</Text>}
      </View>

      {verifying && <Text variant="muted">Verifying…</Text>}

      <Button
        variant="secondary"
        onPress={resend}
        disabled={cooldown > 0 || verifying}
        loading={resending}
      >
        {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
      </Button>

      <View className="gap-1">
        <Button variant="ghost" onPress={() => router.back()}>
          Wrong email? Go back
        </Button>
        <Button variant="ghost" onPress={() => router.replace("/log-in")}>
          Already have an account? Log in instead
        </Button>
      </View>
    </Screen>
  );
}
