import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { PasswordInput } from "@/components/PasswordInput";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { resendSignupCode, signIn } from "@/lib/auth-api";
import { mapAuthError } from "@/lib/auth-errors";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

export default function LogInScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submittingRef = useRef(false);

  async function submit() {
    if (submittingRef.current) return;
    const eErr = isValidEmail(email) ? null : "Enter a valid email address.";
    setEmailError(eErr);
    if (eErr) return;

    submittingRef.current = true;
    setPending(true);
    setFormError(null);
    const { error } = await signIn(email, password);
    submittingRef.current = false;
    setPending(false);
    if (error) {
      // GoTrue returns email_not_confirmed ONLY when the password is
      // correct (wrong passwords get invalid_credentials — probed
      // locally). Safe to resend a fresh code + route to verify; the
      // server enforces the resend rate limit.
      if (error.code === "email_not_confirmed") {
        void resendSignupCode(email);
        router.push({
          pathname: "/verify",
          params: { email: normalizeEmail(email) },
        });
        return;
      }
      // All other login errors are deliberately generic — they never
      // reveal whether the email exists.
      setFormError(mapAuthError(error));
      return;
    }
    // Session lands via onAuthStateChange; the guard routes us.
  }

  return (
    <Screen scroll contentClassName="gap-6">
      <View className="gap-2 pt-6">
        <Text variant="heading">Log in</Text>
        <Text variant="muted">Welcome back. Ready to defend your school?</Text>
      </View>

      <View className="gap-2">
        <Label nativeID="login-email-label">Email</Label>
        <Input
          nativeID="login-email"
          testID="login-email"
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
        <Label nativeID="login-password-label">Password</Label>
        <PasswordInput
          ref={passwordRef}
          nativeID="login-password"
          testID="login-password"
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={submit}
          editable={!pending}
        />
      </View>

      {formError && <Text variant="danger">{formError}</Text>}

      <Button testID="login-submit" onPress={submit} loading={pending}>
        Log in
      </Button>

      <View className="gap-1">
        <Button variant="ghost" onPress={() => router.push("/forgot-password")}>
          Forgot password?
        </Button>
        <Button variant="ghost" onPress={() => router.replace("/pick-school")}>
          New here? Create account
        </Button>
      </View>
    </Screen>
  );
}
