import { resolveRouteArea, type AuthRouteInput } from "@/lib/route-guards";

const base: AuthRouteInput = {
  session: "none",
  recoveryInProgress: false,
  profileStatus: "idle",
  onboarded: false,
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

  it("session + loaded profile + not onboarded → onboarding", () => {
    expect(
      resolveRouteArea(
        state({ session: "active", profileStatus: "loaded", onboarded: false }),
      ),
    ).toBe("onboarding");
  });

  it("session + loaded profile + onboarded → tabs", () => {
    expect(
      resolveRouteArea(
        state({ session: "active", profileStatus: "loaded", onboarded: true }),
      ),
    ).toBe("tabs");
  });

  it("recovery when onboarded → stays in auth (password not set yet)", () => {
    expect(
      resolveRouteArea(
        state({
          session: "active",
          recoveryInProgress: true,
          profileStatus: "loaded",
          onboarded: true,
        }),
      ),
    ).toBe("auth");
  });

  it("recovery when not onboarded → stays in auth, not onboarding", () => {
    expect(
      resolveRouteArea(
        state({
          session: "active",
          recoveryInProgress: true,
          profileStatus: "loaded",
          onboarded: false,
        }),
      ),
    ).toBe("auth");
  });
});
