import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";

import OnboardingScreen from "@/app/onboarding";
import { useAuth } from "@/lib/auth";
import { signOut } from "@/lib/auth-api";
import { useCompleteOnboarding, useMyUniversity } from "@/lib/profile";

jest.mock("@/lib/supabase", () => ({ supabase: {} }));

jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));

jest.mock("@/lib/auth-api", () => ({
  signOut: jest.fn(),
  RESEND_COOLDOWN_SECONDS: 60,
}));

// mapOnboardingError stays real; only the hooks are mocked.
jest.mock("@/lib/profile", () => ({
  ...jest.requireActual("@/lib/profile"),
  useCompleteOnboarding: jest.fn(),
  useMyUniversity: jest.fn(),
}));

const mockedAuth = useAuth as jest.Mock;
const mockedUni = useMyUniversity as jest.Mock;
const mockedComplete = useCompleteOnboarding as jest.Mock;

const refetch = jest.fn();
const mutateAsync = jest.fn();

const SCHOOL = { id: "u1", name: "University of Virginia", short_name: "UVA" };

function setup(over?: { uni?: object; mutateImpl?: () => Promise<void> }) {
  mockedAuth.mockReturnValue({
    profile: { id: "p1", university_id: "u1", onboarded_at: null },
    refetchProfile: refetch,
  });
  mockedUni.mockReturnValue({ data: SCHOOL, isError: false, ...over?.uni });
  mutateAsync.mockImplementation(over?.mutateImpl ?? (async () => {}));
  mockedComplete.mockReturnValue({
    mutateAsync,
    isPending: false,
  });
}

describe("OnboardingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setup();
  });

  it("greets with the school short name when it loads", async () => {
    await render(<OnboardingScreen />);
    expect(screen.getByText("Welcome to UVA!")).toBeTruthy();
  });

  it("falls back to a generic greeting when the school fails to load", async () => {
    setup({ uni: { data: undefined, isError: true } });
    await render(<OnboardingScreen />);
    expect(screen.getByText("One last thing")).toBeTruthy();
    // The form itself is never blocked.
    expect(screen.getByTestId("display-name")).toBeTruthy();
  });

  it("shows a live code-point counter (emoji count as one each)", async () => {
    await render(<OnboardingScreen />);
    const field = screen.getByTestId("display-name");
    await fireEvent.changeText(field, "ab🎓");
    expect(screen.getByText("3/20")).toBeTruthy();
    await fireEvent.changeText(field, "👨‍👩‍👧"); // ZWJ sequence = 5 code points
    expect(screen.getByText("5/20")).toBeTruthy();
    await fireEvent.changeText(field, "  ab  ");
    expect(screen.getByText("2/20")).toBeTruthy();
  });

  it("blocks names outside 2–20 code points without calling the RPC", async () => {
    await render(<OnboardingScreen />);
    const field = screen.getByTestId("display-name");
    for (const bad of ["a", "x".repeat(21)]) {
      await fireEvent.changeText(field, bad);
      await fireEvent.press(screen.getByTestId("onboarding-submit"));
      expect(screen.getByText(/2–20 characters/i)).toBeTruthy();
    }
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("accepts the 2-char boundary", async () => {
    await render(<OnboardingScreen />);
    await fireEvent.changeText(screen.getByTestId("display-name"), "ab");
    await fireEvent.press(screen.getByTestId("onboarding-submit"));
    expect(mutateAsync).toHaveBeenCalledWith("ab");
  });

  it("accepts the 20-char boundary and trims surrounding spaces", async () => {
    await render(<OnboardingScreen />);
    await fireEvent.changeText(
      screen.getByTestId("display-name"),
      `  ${"x".repeat(20)}  `,
    );
    await fireEvent.press(screen.getByTestId("onboarding-submit"));
    expect(mutateAsync).toHaveBeenCalledWith(`  ${"x".repeat(20)}  `);
  });

  it("maps the profanity rejection to friendly copy", async () => {
    setup({
      mutateImpl: async () => {
        throw { code: "P0001", message: "display_name is not allowed" };
      },
    });
    await render(<OnboardingScreen />);
    await fireEvent.changeText(
      screen.getByTestId("display-name"),
      "badword",
    );
    await fireEvent.press(screen.getByTestId("onboarding-submit"));
    expect(screen.getByText(/isn't allowed/i)).toBeTruthy();
  });

  it("celebration stays visible after success until the Home tap, then refetches", async () => {
    await render(<OnboardingScreen />);
    await fireEvent.changeText(
      screen.getByTestId("display-name"),
      "Champ",
    );
    await fireEvent.press(screen.getByTestId("onboarding-submit"));

    // Success → celebration visible…
    expect(screen.getByText("You're in!")).toBeTruthy();
    // …and the profile is NOT refreshed until the CTA (guard must not
    // move the user mid-celebration).
    expect(refetch).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("onboarding-home"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows a retry path when the profile refetch fails", async () => {
    refetch.mockRejectedValueOnce(new Error("offline"));
    await render(<OnboardingScreen />);
    await fireEvent.changeText(screen.getByTestId("display-name"), "Champ");
    await fireEvent.press(screen.getByTestId("onboarding-submit"));
    await fireEvent.press(screen.getByTestId("onboarding-home"));
    expect(screen.getByText(/couldn't load your profile/i)).toBeTruthy();
    // Tapping again retries.
    await fireEvent.press(screen.getByTestId("onboarding-home"));
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("Log out is always visible (never trapped)", async () => {
    await render(<OnboardingScreen />);
    expect(screen.getByTestId("onboarding-logout")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("display-name"), "Champ");
    await fireEvent.press(screen.getByTestId("onboarding-submit"));
    // Still visible on the celebration screen.
    expect(screen.getByTestId("onboarding-logout")).toBeTruthy();
  });
});
