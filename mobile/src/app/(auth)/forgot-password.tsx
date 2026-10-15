import { useCallback, useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { CodeInput } from "@/components/CodeInput";
import { PasswordInput } from "@/components/PasswordInput";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth";
import {
  RESEND_COOLDOWN_SECONDS,
  sendPasswordReset,
  signOut,
  updatePassword,
  verifyCode,
} from "@/lib/auth-api";
import { mapAuthError } from "@/lib/auth-errors";
import { isCompleteCode, isValidEmail, passwordError } from "@/lib/validation";

type Step = "email" | "code" | "password";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { beginRecovery, endRecovery } = useAuth();
  const codeRef = useRef<TextInput>(null);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Tracks whether the password step completed, so the unmount cleanup
  // can tell "guard navigated us away after success" from "user bailed
  // mid-recovery" — the latter leaves a live recovery session behind.
  const completedRef = useRef(false);
  const submittingRef = useRef(false);
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(
    () => () => {
      if (stepRef.current === "password" && !completedRef.current) {
        void signOut();
      }
    },
    [],
  );

  const cooldownActive = cooldown > 0;
  useEffect(() => {
    if (!cooldownActive) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldownActive]);

  async function requestCode(isResend = false) {
    const eErr = isValidEmail(email) ? null : "Enter a valid email address.";
    setFieldError(eErr);
    if (eErr) return;

    if (isResend) setResending(true);
    else setPending(true);
    setFormError(null);
    const { error } = await sendPasswordReset(email);
    if (isResend) setResending(false);
    else setPending(false);
    if (error) {
      setFormError(mapAuthError(error));
      return;
    }
    // Neutral response regardless of whether the account exists.
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setStep("code");
  }

  const submitCode = useCallback(
    async (value: string) => {
      if (pending || submittingRef.current || !isCompleteCode(value)) return;
      // Flag BEFORE verify — the recovery session must never route
      // past this screen (see the truth table in route-guards.ts).
      beginRecovery();
      submittingRef.current = true;
      setPending(true);
      setFormError(null);
      const { error } = await verifyCode(email, value, "recovery");
      submittingRef.current = false;
      setPending(false);
      if (error) {
        endRecovery(); // no session was created — roll the flag back
        setCode("");
        setFormError(mapAuthError(error));
        codeRef.current?.focus();
        return;
      }
      setStep("password");
    },
    [email, pending, beginRecovery, endRecovery],
  );

  async function submitPassword() {
    if (submittingRef.current) return;
    const pErr = passwordError(password);
    setFieldError(pErr);
    if (pErr) return;

    submittingRef.current = true;
    setPending(true);
    setFormError(null);
    const { error } = await updatePassword(password);
    if (error) {
      submittingRef.current = false;
      setPending(false);
      setFormError(mapAuthError(error));
      return;
    }
    completedRef.current = true;
    // Revoke sessions on other devices; the current session stays.
    await signOut("others").catch(() => {});
    endRecovery();
    submittingRef.current = false;
    setPending(false);
    // Guard routes onward based on university_id.
  }

  return (
    <Screen scroll contentClassName="gap-6">
      <View className="gap-2 pt-6">
        <Text variant="heading">Reset password</Text>
        {step === "email" && (
          <Text variant="muted">
            Enter your account email. If an account exists for it, a
            6-digit code is on the way.
          </Text>
        )}
        {step === "code" && (
          <Text variant="muted">
            If an account exists for {email}, we sent a 6-digit code.
            Enter it here.
          </Text>
        )}
        {step === "password" && (
          <Text variant="muted">Almost done — choose a new password.</Text>
        )}
      </View>

      {step === "email" && (
        <>
          <View className="gap-2">
            <Label nativeID="fp-email-label">Email</Label>
            <Input
              nativeID="fp-email"
              testID="fp-email"
              placeholder="you@university.edu"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => requestCode()}
              error={!!fieldError}
              editable={!pending}
            />
            {fieldError && <Text variant="danger">{fieldError}</Text>}
          </View>
          <Button onPress={() => requestCode()} loading={pending}>
            Send code
          </Button>
        </>
      )}

      {step === "code" && (
        <>
          <View className="gap-2">
            <Label nativeID="fp-code-label">Reset code</Label>
            <CodeInput
              ref={codeRef}
              nativeID="fp-code"
              testID="fp-code"
              value={code}
              onChangeCode={setCode}
              onComplete={submitCode}
              error={!!formError}
              editable={!pending}
            />
          </View>
          <Button
            variant="secondary"
            onPress={() => requestCode(true)}
            disabled={cooldown > 0 || pending || resending}
            loading={resending}
          >
            {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
          </Button>
        </>
      )}

      {step === "password" && (
        <>
          <View className="gap-2">
            <Label nativeID="fp-password-label">New password</Label>
            <PasswordInput
              nativeID="fp-password"
              testID="fp-password"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={submitPassword}
              error={!!fieldError}
              editable={!pending}
            />
            {fieldError && <Text variant="danger">{fieldError}</Text>}
          </View>
          <Button onPress={submitPassword} loading={pending}>
            Set new password
          </Button>
        </>
      )}

      {formError && <Text variant="danger">{formError}</Text>}

      {step !== "password" && (
        <Button variant="ghost" onPress={() => router.back()}>
          Back to log in
        </Button>
      )}
    </Screen>
  );
}
