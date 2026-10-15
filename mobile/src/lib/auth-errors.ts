import type { AuthError } from "@supabase/supabase-js";

/** Friendly auth errors. Never surfaces raw Supabase messages. */
const GENERIC = "Something went wrong. Please try again.";

export function mapAuthError(error: AuthError | null | undefined): string {
  if (!error) return GENERIC;

  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  // Offline / unreachable (supabase-js wraps fetch failures).
  if (
    error.name === "AuthRetryableFetchError" ||
    error.name === "AuthFetchError" ||
    message.includes("failed to fetch") ||
    message.includes("network request failed")
  ) {
    console.log("Network error:", error);
    return "No connection. Check your internet and try again.";
  }

  // Login failures deliberately do not reveal whether the email exists.
  if (code === "invalid_credentials" || code === "email_not_confirmed") {
    return "Incorrect email or password.";
  }

  if (code === "user_already_exists" || message.includes("already registered")) {
    return "That email is already registered. Try logging in.";
  }

  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    message.includes("rate limit") ||
    message.includes("too many")
  ) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (
    code === "otp_expired" ||
    message.includes("token has expired") ||
    message.includes("invalid token")
  ) {
    return "That code is wrong or has expired. Request a new one.";
  }

  if (code === "weak_password" || message.includes("password")) {
    return "Password must be at least 8 characters.";
  }

  return GENERIC;
}
