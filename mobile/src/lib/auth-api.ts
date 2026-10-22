import { supabase } from "@/lib/supabase";
import { normalizeEmail } from "@/lib/validation";

/** Client-side resend cooldown — matches config.toml max_frequency="60s". */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Single entry point for every auth call. Screens never touch
 * `supabase.auth` directly; tests mock this module.
 * Emails are normalized (trim + lowercase) here once.
 */
export async function signUp(
  email: string,
  password: string,
  universityId: string,
) {
  return supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: { data: { university_id: universityId } },
  });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });
}

export type OtpType = "signup" | "recovery";

export async function verifyCode(email: string, code: string, type: OtpType) {
  return supabase.auth.verifyOtp({
    email: normalizeEmail(email),
    token: code,
    type,
  });
}

export async function resendSignupCode(email: string) {
  return supabase.auth.resend({
    type: "signup",
    email: normalizeEmail(email),
  });
}

export async function sendPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(normalizeEmail(email));
}

export async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}

export async function signOut(scope: "local" | "others" | "global" = "local") {
  return supabase.auth.signOut({ scope });
}
