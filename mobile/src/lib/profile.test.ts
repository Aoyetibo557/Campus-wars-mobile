import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  mapOnboardingError,
  NAME_RULES_COPY,
  PROFANITY_MARKER,
} from "@/lib/profile";

jest.mock("@/lib/supabase", () => ({ supabase: {} }));

const err = (partial: object) => ({ ...partial }) as never;

describe("mapOnboardingError (verified live against the local stack)", () => {
  it("maps the profanity trigger (P0001 + marker)", () => {
    // exact shape seen via select public.complete_onboarding('fuck you')
    const e = err({ code: "P0001", message: "display_name is not allowed" });
    expect(mapOnboardingError(e)).toBe(
      "That name isn't allowed. Try a different one.",
    );
  });

  it("maps the length check violation (23514 + constraint name)", () => {
    // exact shape seen via select public.complete_onboarding('x')
    const e = err({
      code: "23514",
      message:
        'new row for relation "profiles" violates check constraint "profiles_display_name_check"',
    });
    expect(mapOnboardingError(e)).toBe(NAME_RULES_COPY);
  });

  it("maps network failures", () => {
    expect(
      mapOnboardingError(err({ message: "Network request failed" })),
    ).toMatch(/connection/i);
  });

  it("falls back to generic for unknown errors", () => {
    expect(
      mapOnboardingError(err({ code: "P0001", message: "not authenticated" })),
    ).toMatch(/something went wrong/i);
    expect(mapOnboardingError(undefined)).toMatch(/something went wrong/i);
  });
});

describe("PROFANITY_MARKER drift guard", () => {
  it("exists verbatim in the migration that raises it", () => {
    const dir = join(__dirname, "../../../supabase/migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    expect(sql).toContain(PROFANITY_MARKER);
  });
});
