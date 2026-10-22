import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AuthError } from "@supabase/supabase-js";

import {
  CONFIRM_COLLISION_COPY,
  HOOK_REJECT_MARKER,
  isConfirmCollision,
  mapAuthError,
  mapSignupError,
  SIGNUP_REJECT_COPY,
} from "@/lib/auth-errors";

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

  it("maps the mailbox collision to neutral copy (never 'wrong code')", () => {
    const e = err({ message: "Error confirming user", status: 500 });
    expect(isConfirmCollision(e)).toBe(true);
    expect(mapAuthError(e)).toBe(CONFIRM_COLLISION_COPY);
  });
});

describe("mapSignupError", () => {
  it("maps the hook rejection to neutral copy", () => {
    const e = err({
      message: "That email can't be used to sign up for this school.",
      status: 400,
    });
    expect(mapSignupError(e)).toBe(SIGNUP_REJECT_COPY);
  });

  it("maps any other unknown 400 to the same neutral copy", () => {
    expect(
      mapSignupError(err({ message: "unexpected hook failure", status: 400 })),
    ).toBe(SIGNUP_REJECT_COPY);
  });

  it("keeps specific mappings for known codes", () => {
    expect(
      mapSignupError(err({ code: "over_email_send_rate_limit" })),
    ).toMatch(/too many/i);
  });
});

describe("HOOK_REJECT_MARKER drift guard", () => {
  it("exists verbatim in the migration that raises it", () => {
    const dir = join(
      __dirname,
      "../../../supabase/migrations",
    );
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n")
      .toLowerCase();
    expect(sql).toContain(HOOK_REJECT_MARKER);
  });
});
