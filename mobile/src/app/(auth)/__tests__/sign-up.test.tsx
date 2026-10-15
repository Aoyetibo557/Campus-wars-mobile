import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";

import SignUpScreen from "@/app/(auth)/sign-up";
import { signUp } from "@/lib/auth-api";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
  }),
}));

jest.mock("@/lib/auth-api", () => ({
  signUp: jest.fn(),
  RESEND_COOLDOWN_SECONDS: 60,
}));

const mockedSignUp = signUp as jest.MockedFunction<typeof signUp>;

describe("SignUpScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    } as Awaited<ReturnType<typeof signUp>>);
  });

  it("shows inline errors and never calls the API on invalid input", async () => {
    await render(<SignUpScreen />);
    await fireEvent.changeText(screen.getByTestId("signup-email"), "nope");
    await fireEvent.changeText(
      screen.getByTestId("signup-password"),
      "short",
    );
    await fireEvent.press(screen.getByTestId("signup-submit"));

    expect(screen.getByText(/valid email/i)).toBeTruthy();
    expect(screen.getByText(/at least 8/i)).toBeTruthy();
    expect(mockedSignUp).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("submits a normalized email and navigates to verify", async () => {
    await render(<SignUpScreen />);
    await fireEvent.changeText(
      screen.getByTestId("signup-email"),
      "  ANU@Uni.EDU ",
    );
    await fireEvent.changeText(
      screen.getByTestId("signup-password"),
      "password1",
    );
    await fireEvent.press(screen.getByTestId("signup-submit"));

    expect(mockedSignUp).toHaveBeenCalledWith("  ANU@Uni.EDU ", "password1");
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/verify",
      params: { email: "anu@uni.edu" },
    });
  });

  it("does not double submit while pending", async () => {
    let resolve: (v: unknown) => void = () => {};
    mockedSignUp.mockImplementation(
      () => new Promise((r) => (resolve = r)) as never,
    );
    await render(<SignUpScreen />);
    await fireEvent.changeText(screen.getByTestId("signup-email"), "a@b.co");
    await fireEvent.changeText(
      screen.getByTestId("signup-password"),
      "password1",
    );
    const button = screen.getByTestId("signup-submit");
    // Simultaneous presses genuinely produce overlapping act() calls —
    // that's the race the submittingRef guard exists for. The first press
    // suspends on the pending promise, so its act never resolves; hush
    // only that expected warning.
    const errSpy = jest
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        if (String(args[0]).includes("overlapping act")) return;
      });
    try {
      await act(async () => {
        void fireEvent.press(button);
        void fireEvent.press(button);
        resolve({ data: {}, error: null });
      });
      expect(mockedSignUp).toHaveBeenCalledTimes(1);
    } finally {
      errSpy.mockRestore();
    }
  });
});
