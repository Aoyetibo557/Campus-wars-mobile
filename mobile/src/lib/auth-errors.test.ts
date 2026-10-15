import type { AuthError } from "@supabase/supabase-js";

import { mapAuthError } from "@/lib/auth-errors";

const err = (partial: Partial<AuthError>) =>
  ({ message: "", ...partial }) as AuthError;

describe("mapAuthError", () => {
  it("returns one generic message for login failures", () => {
    const msg = mapAuthError(err({ code: "invalid_credentials" }));
    expect(msg).toBe("Incorrect email or password.");
    expect(mapAuthError(err({ code: "email_not_confirmed" }))).toBe(msg);
  });

  it("maps rate limits", () => {
    expect(
      mapAuthError(err({ code: "over_request_rate_limit" })),
    ).toMatch(/too many/i);
    expect(
      mapAuthError(err({ code: "over_email_send_rate_limit" })),
    ).toMatch(/too many/i);
  });

  it("maps wrong/expired codes", () => {
    expect(mapAuthError(err({ code: "otp_expired" }))).toMatch(/code/i);
    expect(
      mapAuthError(err({ message: "Token has expired or is invalid" })),
    ).toMatch(/code/i);
  });

  it("maps offline/network failures", () => {
    expect(
      mapAuthError(err({ name: "AuthRetryableFetchError" })),
    ).toMatch(/connection/i);
    expect(
      mapAuthError(err({ message: "Network request failed" })),
    ).toMatch(/connection/i);
  });

  it("maps weak passwords", () => {
    expect(mapAuthError(err({ code: "weak_password" }))).toMatch(/8/);
  });

  it("falls back to a generic message for unknown errors", () => {
    expect(mapAuthError(err({ code: "totally_new_code" }))).toMatch(
      /something went wrong/i,
    );
    expect(mapAuthError(undefined)).toMatch(/something went wrong/i);
  });
});
