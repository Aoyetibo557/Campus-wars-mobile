import {
  resendSignupCode,
  sendPasswordReset,
  signIn,
  signUp,
  verifyCode,
} from "@/lib/auth-api";
import { supabase } from "@/lib/supabase";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: jest.fn(async () => ({ data: {}, error: null })),
      signInWithPassword: jest.fn(async () => ({ data: {}, error: null })),
      verifyOtp: jest.fn(async () => ({ data: {}, error: null })),
      resend: jest.fn(async () => ({ data: {}, error: null })),
      resetPasswordForEmail: jest.fn(async () => ({ data: {}, error: null })),
      updateUser: jest.fn(async () => ({ data: {}, error: null })),
      signOut: jest.fn(async () => ({ error: null })),
    },
  },
}));

const auth = supabase.auth as jest.Mocked<typeof supabase.auth>;
const MESSY = "  ANU@Uni.EDU ";
const CLEAN = "anu@uni.edu";

describe("auth-api email normalization", () => {
  beforeEach(() => jest.clearAllMocks());

  it("signUp passes a trimmed, lowercased email", async () => {
    await signUp(MESSY, "password1");
    expect(auth.signUp).toHaveBeenCalledWith({
      email: CLEAN,
      password: "password1",
    });
  });

  it("signIn passes a trimmed, lowercased email", async () => {
    await signIn(MESSY, "password1");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: CLEAN,
      password: "password1",
    });
  });

  it("verifyCode passes a trimmed, lowercased email", async () => {
    await verifyCode(MESSY, "123456", "signup");
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: CLEAN,
      token: "123456",
      type: "signup",
    });
  });

  it("resendSignupCode passes a trimmed, lowercased email", async () => {
    await resendSignupCode(MESSY);
    expect(auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: CLEAN,
    });
  });

  it("sendPasswordReset passes a trimmed, lowercased email", async () => {
    await sendPasswordReset(MESSY);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(CLEAN);
  });
});
