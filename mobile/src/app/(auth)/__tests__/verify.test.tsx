import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";

import VerifyScreen from "@/app/(auth)/verify";
import { resendSignupCode, verifyCode } from "@/lib/auth-api";

const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({ email: "anu@uni.edu" }),
}));

jest.mock("@/lib/auth-api", () => ({
  verifyCode: jest.fn(),
  resendSignupCode: jest.fn(),
  RESEND_COOLDOWN_SECONDS: 60,
}));

const mockedVerify = verifyCode as jest.MockedFunction<typeof verifyCode>;
const mockedResend = resendSignupCode as jest.MockedFunction<
  typeof resendSignupCode
>;

describe("VerifyScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedVerify.mockResolvedValue({ data: {}, error: null } as never);
    mockedResend.mockResolvedValue({ data: {}, error: null } as never);
  });

  it("auto-submits exactly once when 6 digits are entered", async () => {
    await render(<VerifyScreen />);
    const field = screen.getByTestId("verify-code");
    await fireEvent.changeText(field, "12345");
    expect(mockedVerify).not.toHaveBeenCalled();
    await fireEvent.changeText(field, "123456");
    expect(mockedVerify).toHaveBeenCalledTimes(1);
    expect(mockedVerify).toHaveBeenCalledWith(
      "anu@uni.edu",
      "123456",
      "signup",
    );
  });

  it("clears the code and shows the error on a wrong code", async () => {
    mockedVerify.mockResolvedValue({
      data: {},
      error: { code: "otp_expired", message: "expired" },
    } as never);
    await render(<VerifyScreen />);
    const field = screen.getByTestId("verify-code");
    await fireEvent.changeText(field, "000000");
    expect(screen.getByText(/expired/i)).toBeTruthy();
    expect(field.props.value).toBe("");
  });

  it("blocks resend during the 60s cooldown, then resends", async () => {
    jest.useFakeTimers();
    try {
      await render(<VerifyScreen />);
      // Cooldown starts at 60 because the signup email was just sent.
      await act(async () => {
        await fireEvent.press(screen.getByText(/resend code/i));
      });
      expect(mockedResend).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(61_000);
      });
      await act(async () => {
        await fireEvent.press(screen.getByText("Resend code"));
      });
      expect(mockedResend).toHaveBeenCalledTimes(1);
      expect(mockedResend).toHaveBeenCalledWith("anu@uni.edu");
    } finally {
      jest.useRealTimers();
    }
  });
});
