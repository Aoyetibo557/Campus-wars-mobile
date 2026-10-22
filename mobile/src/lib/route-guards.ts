/**
 * Route-guard truth table (drives <Stack.Protected> in app/_layout.tsx).
 *
 *  session | recovery | profile status | onboarded | where the user belongs
 * ---------+----------+----------------+-----------+------------------------
 *  unknown | any      | any            | any       | splash (still resolving)
 *  none    | any      | any            | any       | (auth) group
 *  active  | true     | any            | any       | (auth) group — the
 *          |          |                |           |   recovery session stays
 *          |          |                |           |   on forgot-password until
 *          |          |                |           |   the password is set
 *  active  | false    | loading        | any       | splash (nothing rendered)
 *  active  | false    | error/no row   | any       | retry screen
 *  active  | false    | loaded         | false     | /onboarding
 *  active  | false    | loaded         | true      | /(tabs)
 *
 * "Error" and a missing profile row are never treated as "not onboarded":
 * onboarding is reached only from a loaded profile with null onboarded_at
 * (the D25 completion rule — the profile trigger sets university_id at
 * signup, so the null-university_id rule is replaced by D25).
 */

export type ProfileStatus = "idle" | "loading" | "loaded" | "error";

export type AuthRouteInput = {
  /** "unknown" = getSession hasn't resolved yet → keep the splash up. */
  session: "unknown" | "none" | "active";
  recoveryInProgress: boolean;
  profileStatus: ProfileStatus;
  /** profile.onboarded_at != null */
  onboarded: boolean;
};

export type RouteArea = "auth" | "splash" | "retry" | "onboarding" | "tabs";

export function resolveRouteArea(input: AuthRouteInput): RouteArea {
  if (input.session === "unknown") return "splash";
  if (input.session === "none" || input.recoveryInProgress) return "auth";
  switch (input.profileStatus) {
    case "idle":
    case "loading":
      return "splash";
    case "error":
      return "retry";
    case "loaded":
      return input.onboarded ? "tabs" : "onboarding";
  }
}
