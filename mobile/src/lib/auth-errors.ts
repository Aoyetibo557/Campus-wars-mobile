import type { AuthError } from "@supabase/supabase-js";

/** Friendly auth errors. Never surfaces raw Supabase messages. */
const GENERIC = "Something went wrong. Please try again.";

/** Neutral copy for signup rejections — same for the hook and any other
 *  unhandled 400, so nothing is revealed about account existence. */
export const SIGNUP_REJECT_COPY =
  "We couldn't create an account with that email for this school.";

/** Substring of the message raised by before_user_created_hook —
 *  migration 20261014212218_school_verification.sql. A unit test asserts
 *  this marker exists in the migration so the two never drift. */
export const HOOK_REJECT_MARKER = "sign up for this school";

/** The DB raises a mailbox-collision error at OTP confirmation; GoTrue
 *  surfaces it only as this generic message. */
const CONFIRM_COLLISION_MESSAGE = "error confirming user";
export const CONFIRM_COLLISION_COPY =
  "We couldn't confirm that email. If you already have an account, try logging in instead.";

/** True when verifyOtp failed because the mailbox is already linked. */
export function isConfirmCollision(
  error: AuthError | null | undefined,
): boolean {
  return (
    (error?.message ?? "").toLowerCase() === CONFIRM_COLLISION_MESSAGE
  );
}

/**
 * Signup-specific mapping: the hook's rejection and any other unknown 400
 * get the same neutral copy (no account-existence signal).
 */
export function mapSignupError(
  error: AuthError | null | undefined,
): string {
  if ((error?.message ?? "").toLowerCase().includes(HOOK_REJECT_MARKER)) {
    return SIGNUP_REJECT_COPY;
  }
  const mapped = mapAuthError(error);
  if (mapped === GENERIC && error?.status === 400) return SIGNUP_REJECT_COPY;
  return mapped;
}

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

  // Mailbox already linked — surfaces only via the generic DB message.
  if (isConfirmCollision(error)) return CONFIRM_COLLISION_COPY;

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
