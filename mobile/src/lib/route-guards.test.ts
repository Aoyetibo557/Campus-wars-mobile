import { resolveRouteArea, type AuthRouteInput } from "@/lib/route-guards";

const base: AuthRouteInput = {
  session: "none",
  recoveryInProgress: false,
  profileStatus: "idle",
  hasSchool: false,
};
const state = (overrides: Partial<AuthRouteInput>) => ({
  ...base,
  ...overrides,
});

describe("resolveRouteArea truth table", () => {
  it("unknown session → splash", () => {
    expect(resolveRouteArea(state({ session: "unknown" }))).toBe("splash");
  });

  it("no session → auth", () => {
    expect(resolveRouteArea(state({ session: "none" }))).toBe("auth");
  });

  it("session + profile loading → splash", () => {
    expect(
      resolveRouteArea(
        state({ session: "active", profileStatus: "loading" }),
      ),
    ).toBe("splash");
  });

  it("session + profile error → retry (never 'no school')", () => {
    expect(
      resolveRouteArea(state({ session: "active", profileStatus: "error" })),
    ).toBe("retry");
  });

  it("session + loaded profile + null school → onboarding", () => {
    expect(
      resolveRouteArea(
        state({ session: "active", profileStatus: "loaded", hasSchool: false }),
      ),
    ).toBe("onboarding");
  });

  it("session + loaded profile + school → tabs", () => {
    expect(
      resolveRouteArea(
        state({ session: "active", profileStatus: "loaded", hasSchool: true }),
      ),
    ).toBe("tabs");
  });

  it("recovery with a school → stays in auth (password not set yet)", () => {
    expect(
      resolveRouteArea(
        state({
          session: "active",
          recoveryInProgress: true,
          profileStatus: "loaded",
          hasSchool: true,
        }),
      ),
    ).toBe("auth");
  });

  it("recovery without a school → stays in auth, not onboarding", () => {
    expect(
      resolveRouteArea(
        state({
          session: "active",
          recoveryInProgress: true,
          profileStatus: "loaded",
          hasSchool: false,
        }),
      ),
    ).toBe("auth");
  });
});
