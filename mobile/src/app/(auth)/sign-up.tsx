import { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { PasswordInput } from "@/components/PasswordInput";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { signUp } from "@/lib/auth-api";
import { mapSignupError } from "@/lib/auth-errors";
import { domainHint, emailMatchesDomainList } from "@/lib/email-domain";
import { useSignupFlow } from "@/lib/signup-flow";
import { isValidEmail, normalizeEmail, passwordError } from "@/lib/validation";

export default function SignUpScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);
  const school = useSignupFlow((s) => s.school);

  // Deep-link/defensive: signup without a picked school goes back to the
  // picker (the flow's entry point).
  useEffect(() => {
    if (!school) router.replace("/pick-school");
  }, [school, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Same-tick reentrancy guard — the disabled/loading state doesn't apply
  // until the next render, so state alone can't stop a rapid double tap.
  const submittingRef = useRef(false);

  if (!school) return null;
  // TS can't narrow a closure-captured store value — bind the narrowed one.
  const picked = school;
  const domains = picked.email_domains ?? [];

  async function submit() {
    if (submittingRef.current) return;
    const eErr = !isValidEmail(email)
      ? "Enter a valid email address."
      : !emailMatchesDomainList(email, domains)
        ? `That email isn't a ${picked.short_name ?? picked.name} address.`
        : null;
    const pErr = passwordError(password);
    setEmailError(eErr);
    setPwError(pErr);
    if (eErr || pErr) return;

    submittingRef.current = true;
    setPending(true);
    setFormError(null);
    const { error } = await signUp(email, password, picked.id);
    submittingRef.current = false;
    setPending(false);
    if (error) {
      setFormError(mapSignupError(error));
      return;
    }
    // Neutral copy lives on the verify screen — we never confirm whether
    // this email already has an account. The school stays in the store:
    // "Wrong email?" on Verify returns here with it preserved.
    router.push({
      pathname: "/verify",
      params: { email: normalizeEmail(email) },
    });
  }

  const hint = domainHint(domains);

  return (
    <Screen scroll contentClassName="gap-6">
      <View className="gap-2 pt-6">
        <Text variant="heading">Create account</Text>
      </View>

      <View className="flex-row items-center justify-between rounded-md border border-border bg-surface px-3 py-3">
        <View className="flex-1 gap-0.5">
          <Text variant="label">{school.name}</Text>
          <Text variant="muted" className="text-xs">
            {`${school.state ? `${school.state} · ` : ""}can't be changed later`}
          </Text>
        </View>
        <Button variant="ghost" onPress={() => router.back()}>
          Change
        </Button>
      </View>

      <View className="gap-2">
        <Label nativeID="signup-email-label">School email</Label>
        <Input
          nativeID="signup-email"
          aria-labelledby="signup-email-label"
          testID="signup-email"
          placeholder={hint ? `you@${domains[0]}` : "you@university.edu"}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={!!emailError}
          editable={!pending}
        />
        {hint && (
          <Text variant="muted" className="text-xs">
            Use your {hint} email.
          </Text>
        )}
        {emailError && <Text variant="danger">{emailError}</Text>}
      </View>

      <View className="gap-2">
        <Label nativeID="signup-password-label">Password</Label>
        <PasswordInput
          ref={passwordRef}
          nativeID="signup-password"
          testID="signup-password"
          placeholder="At least 8 characters"
          value={password}
          onChangeText={setPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
          error={!!pwError}
          editable={!pending}
        />
        {pwError && <Text variant="danger">{pwError}</Text>}
      </View>

      {formError && <Text variant="danger">{formError}</Text>}

      <Button testID="signup-submit" onPress={submit} loading={pending}>
        Create account
      </Button>

      <Button
        variant="ghost"
        onPress={() => {
          useSignupFlow.getState().clear();
          router.replace("/log-in");
        }}
      >
        Already have an account? Log in
      </Button>
    </Screen>
  );
}
