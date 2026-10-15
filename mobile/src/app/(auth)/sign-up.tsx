import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { PasswordInput } from "@/components/PasswordInput";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { signUp } from "@/lib/auth-api";
import { mapAuthError } from "@/lib/auth-errors";
import { isValidEmail, normalizeEmail, passwordError } from "@/lib/validation";

export default function SignUpScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Same-tick reentrancy guard — the disabled/loading state doesn't apply
  // until the next render, so state alone can't stop a rapid double tap.
  const submittingRef = useRef(false);

  async function submit() {
    if (submittingRef.current) return;
    const eErr = isValidEmail(email)
      ? null
      : "Enter a valid email address.";
    const pErr = passwordError(password);
    setEmailError(eErr);
    setPwError(pErr);
    if (eErr || pErr) return;

    submittingRef.current = true;
    setPending(true);
    setFormError(null);
    const { error } = await signUp(email, password);
    submittingRef.current = false;
    setPending(false);
    if (error) {
      setFormError(mapAuthError(error));
      return;
    }
    // Neutral copy lives on the verify screen — we never confirm whether
    // this email already has an account.
    router.push({
      pathname: "/verify",
      params: { email: normalizeEmail(email) },
    });
  }

  return (
    <Screen scroll contentClassName="gap-6">
      <View className="gap-2 pt-6">
        <Text variant="heading">Create account</Text>
        <Text variant="muted">
          Use your school email. You will get a 6-digit code to verify it.
        </Text>
      </View>

      <View className="gap-2">
        <Label nativeID="signup-email-label">Email</Label>
        <Input
          nativeID="signup-email"
          aria-labelledby="signup-email-label"
          testID="signup-email"
          placeholder="you@university.edu"
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

      <Button variant="ghost" onPress={() => router.replace("/log-in")}>
        Already have an account? Log in
      </Button>
    </Screen>
  );
}
