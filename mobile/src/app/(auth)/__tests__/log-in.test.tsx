import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";

import LogInScreen from "@/app/(auth)/log-in";
import { resendSignupCode, signIn } from "@/lib/auth-api";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
}));

jest.mock("@/lib/auth-api", () => ({
  signIn: jest.fn(),
  resendSignupCode: jest.fn(),
  RESEND_COOLDOWN_SECONDS: 60,
}));

const mockedSignIn = signIn as jest.MockedFunction<typeof signIn>;
const mockedResend = resendSignupCode as jest.MockedFunction<
  typeof resendSignupCode
>;

describe("LogInScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResend.mockResolvedValue({ data: {}, error: null } as never);
  });

  it("wrong password → generic error, no resend, no verify route", async () => {
    mockedSignIn.mockResolvedValue({
      data: {},
      error: { code: "invalid_credentials", status: 400 },
    } as never);
    await render(<LogInScreen />);
    await fireEvent.changeText(
      screen.getByTestId("login-email"),
      "a@virginia.edu",
    );
    await fireEvent.changeText(
      screen.getByTestId("login-password"),
      "wrong-pass",
    );
    await fireEvent.press(screen.getByTestId("login-submit"));
    expect(screen.getByText(/incorrect email or password/i)).toBeTruthy();
    expect(mockedResend).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("correct password on unconfirmed → resends code + routes to verify", async () => {
    mockedSignIn.mockResolvedValue({
      data: {},
      error: { code: "email_not_confirmed", status: 400 },
    } as never);
    await render(<LogInScreen />);
    await fireEvent.changeText(
      screen.getByTestId("login-email"),
      "  A@Virginia.EDU ",
    );
    await fireEvent.changeText(
      screen.getByTestId("login-password"),
      "password1",
    );
    await fireEvent.press(screen.getByTestId("login-submit"));
    expect(mockedResend).toHaveBeenCalledWith("  A@Virginia.EDU ");
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/verify",
      params: { email: "a@virginia.edu" },
    });
  });
});
