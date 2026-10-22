import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";

import SignUpScreen from "@/app/(auth)/sign-up";
import { signUp } from "@/lib/auth-api";
import { useSignupFlow } from "@/lib/signup-flow";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
}));

jest.mock("@/lib/auth-api", () => ({
  signUp: jest.fn(),
  RESEND_COOLDOWN_SECONDS: 60,
}));

const mockedSignUp = signUp as jest.MockedFunction<typeof signUp>;

const SCHOOL = {
  id: "u-uva",
  name: "University of Virginia-Main Campus",
  short_name: "UVA",
  state: "VA",
  email_domains: ["virginia.edu"],
};

describe("SignUpScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSignupFlow.getState().clear();
    useSignupFlow.getState().setSchool(SCHOOL);
    mockedSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    } as Awaited<ReturnType<typeof signUp>>);
  });

  it("shows the chosen school with a way back to change it", async () => {
    await render(<SignUpScreen />);
    expect(screen.getByText(SCHOOL.name)).toBeTruthy();
    await fireEvent.press(screen.getByText("Change"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("shows the email hint built from the school's domains", async () => {
    await render(<SignUpScreen />);
    expect(screen.getByText(/use your virginia\.edu email/i)).toBeTruthy();
  });

  it("redirects to pick-school when no school is selected", async () => {
    useSignupFlow.getState().clear();
    await render(<SignUpScreen />);
    expect(mockReplace).toHaveBeenCalledWith("/pick-school");
  });

  it("blocks a non-school email inline and never calls the API", async () => {
    await render(<SignUpScreen />);
    await fireEvent.changeText(
      screen.getByTestId("signup-email"),
      "a@gmail.com",
    );
    await fireEvent.changeText(
      screen.getByTestId("signup-password"),
      "password1",
    );
    await fireEvent.press(screen.getByTestId("signup-submit"));
    expect(screen.getByText(/isn't a UVA address/i)).toBeTruthy();
    expect(mockedSignUp).not.toHaveBeenCalled();
  });

  it("blocks lookalike domains too (dot-boundary rule)", async () => {
    await render(<SignUpScreen />);
    for (const bad of ["a@evilvirginia.edu", "a@virginia.edu.evil.com"]) {
      await fireEvent.changeText(screen.getByTestId("signup-email"), bad);
      await fireEvent.press(screen.getByTestId("signup-submit"));
      expect(screen.getByText(/isn't a UVA address/i)).toBeTruthy();
    }
    expect(mockedSignUp).not.toHaveBeenCalled();
  });

  it("accepts a subdomain and submits with university_id metadata", async () => {
    await render(<SignUpScreen />);
    await fireEvent.changeText(
      screen.getByTestId("signup-email"),
      "A@CS.Virginia.EDU",
    );
    await fireEvent.changeText(
      screen.getByTestId("signup-password"),
      "password1",
    );
    await fireEvent.press(screen.getByTestId("signup-submit"));

    expect(mockedSignUp).toHaveBeenCalledWith(
      "A@CS.Virginia.EDU",
      "password1",
      "u-uva",
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/verify",
      params: { email: "a@cs.virginia.edu" },
    });
  });

  it("maps the hook rejection to neutral friendly copy", async () => {
    mockedSignUp.mockResolvedValue({
      data: {},
      error: {
        status: 400,
        message: "That email can't be used to sign up for this school.",
      },
    } as never);
    await render(<SignUpScreen />);
    await fireEvent.changeText(
      screen.getByTestId("signup-email"),
      "a@virginia.edu",
    );
    await fireEvent.changeText(
      screen.getByTestId("signup-password"),
      "password1",
    );
    await fireEvent.press(screen.getByTestId("signup-submit"));
    expect(
      screen.getByText(/couldn't create an account/i),
    ).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("keeps the school in the store after success (back from Verify)", async () => {
    await render(<SignUpScreen />);
    await fireEvent.changeText(
      screen.getByTestId("signup-email"),
      "a@virginia.edu",
    );
    await fireEvent.changeText(
      screen.getByTestId("signup-password"),
      "password1",
    );
    await fireEvent.press(screen.getByTestId("signup-submit"));
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/verify" }),
    );
    expect(useSignupFlow.getState().school?.id).toBe("u-uva");
  });

  it("does not double submit while pending", async () => {
    let resolve: (v: unknown) => void = () => {};
    mockedSignUp.mockImplementation(
      () => new Promise((r) => (resolve = r)) as never,
    );
    await render(<SignUpScreen />);
    await fireEvent.changeText(
      screen.getByTestId("signup-email"),
      "a@virginia.edu",
    );
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
