import { create } from "zustand";

/**
 * In-memory school choice for the pick-school → sign-up → verify flow.
 * NOT cleared on signUp success — "Wrong email?" on Verify must come back
 * to a preserved school. Cleared when a session is established (auth.tsx
 * SIGNED_IN) or when the user explicitly leaves for Log in.
 */
export type SignupSchool = {
  id: string;
  name: string;
  short_name: string | null;
  state: string | null;
  email_domains: string[];
};

type SignupFlowState = {
  school: SignupSchool | null;
  setSchool: (school: SignupSchool) => void;
  clear: () => void;
};

export const useSignupFlow = create<SignupFlowState>((set) => ({
  school: null,
  setSchool: (school) => set({ school }),
  clear: () => set({ school: null }),
}));
