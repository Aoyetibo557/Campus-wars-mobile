import { fireEvent, render, screen } from "@testing-library/react-native";

import ForgotPasswordScreen from "@/app/(auth)/forgot-password";
import {
  sendPasswordReset,
  updatePassword,
  verifyCode,
} from "@/lib/auth-api";

const mockBack = jest.fn();
const mockBeginRecovery = jest.fn();
const mockEndRecovery = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
}));

jest.mock("@/lib/auth", () => ({
  useAuth: () => ({
    beginRecovery: mockBeginRecovery,
    endRecovery: mockEndRecovery,
  }),
}));

jest.mock("@/lib/auth-api", () => ({
  sendPasswordReset: jest.fn(),
  verifyCode: jest.fn(),
  updatePassword: jest.fn(),
  signOut: jest.fn(async () => ({ error: null })),
  RESEND_COOLDOWN_SECONDS: 60,
}));

const mockedReset = sendPasswordReset as jest.MockedFunction<
  typeof sendPasswordReset
>;
const mockedVerify = verifyCode as jest.MockedFunction<typeof verifyCode>;
const mockedUpdate = updatePassword as jest.MockedFunction<
  typeof updatePassword
>;

describe("ForgotPasswordScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedReset.mockResolvedValue({ data: {}, error: null } as never);
    mockedVerify.mockResolvedValue({ data: {}, error: null } as never);
    mockedUpdate.mockResolvedValue({ data: {}, error: null } as never);
  });

  it("steps email → code → new password, and beginRecovery runs before verify", async () => {
    await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(
      screen.getByTestId("fp-email"),
      "anu@uni.edu",
    );
    await fireEvent.press(screen.getByText("Send code"));
    expect(mockedReset).toHaveBeenCalledWith("anu@uni.edu");

    await fireEvent.changeText(screen.getByTestId("fp-code"), "654321");
    expect(mockedVerify).toHaveBeenCalledWith(
      "anu@uni.edu",
      "654321",
      "recovery",
    );
    // Flag set BEFORE the call so the recovery session can never route
    // past this screen.
    expect(mockBeginRecovery.mock.invocationCallOrder[0]).toBeLessThan(
      mockedVerify.mock.invocationCallOrder[0],
    );

    // The user stays on the new-password step — nothing navigated away.
    expect(screen.getByText("Set new password")).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("clears the flag and the field on a wrong code", async () => {
    mockedReset.mockResolvedValue({ data: {}, error: null } as never);
    mockedVerify.mockResolvedValue({
      data: {},
      error: { code: "otp_expired", message: "expired" },
    } as never);
    await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByTestId("fp-email"), "a@b.co");
    await fireEvent.press(screen.getByText("Send code"));
    await fireEvent.changeText(screen.getByTestId("fp-code"), "111111");
    expect(mockEndRecovery).toHaveBeenCalled();
    expect(screen.getByTestId("fp-code").props.value).toBe("");
    expect(screen.getByText(/expired/i)).toBeTruthy();
  });
});
