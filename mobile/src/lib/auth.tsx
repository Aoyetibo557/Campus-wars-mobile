import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import type { ProfileStatus } from "@/lib/route-guards";

export type Profile = {
  id: string;
  display_name: string;
  university_id: string | null;
};

type AuthContextValue = {
  session: Session | null;
  /** "unknown" while the persisted session is still resolving. */
  sessionState: "unknown" | "none" | "active";
  profile: Profile | null;
  profileStatus: ProfileStatus;
  /**
   * True once the session AND (when signed in) the profile have resolved —
   * including the error case, so the splash never hangs on a failure.
   */
  ready: boolean;
  /** Recovery OTP verified but the new password is not set yet. */
  recoveryInProgress: boolean;
  /** Set before verifyOtp(type:'recovery'); cleared on password update or abandon. */
  beginRecovery: () => void;
  endRecovery: () => void;
  refetchProfile: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, university_id")
    .eq("id", userId)
    .single();
  // A successful query with no row is treated as an error (retry screen),
  // never as "no school".
  if (error || !data) throw error ?? new Error("profile_missing");
  return data as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recoveryInProgress, setRecoveryInProgress] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      // Never await Supabase calls inside the callback — state updates only.
      setSession(next);
      if (event === "SIGNED_OUT") {
        setRecoveryInProgress(false);
        queryClient.clear();
      }
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryInProgress(true);
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const profileQuery = useQuery({
    queryKey: ["profile", session?.user.id],
    enabled: !!session,
    queryFn: () => fetchProfile(session!.user.id),
    retry: 1,
  });

  const profileStatus: ProfileStatus =
    session === undefined
      ? "loading"
      : !session
        ? "idle"
        : profileQuery.isPending
          ? "loading"
          : profileQuery.isError
            ? "error"
            : "loaded";

  const ready =
    session !== undefined &&
    (!session || profileStatus === "loaded" || profileStatus === "error");

  const { data: profileData, refetch } = profileQuery;
  const refetchProfile = useCallback(() => void refetch(), [refetch]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: session ?? null,
      sessionState:
        session === undefined ? "unknown" : session ? "active" : "none",
      profile: profileData ?? null,
      profileStatus,
      ready,
      recoveryInProgress,
      beginRecovery: () => setRecoveryInProgress(true),
      endRecovery: () => setRecoveryInProgress(false),
      refetchProfile,
    }),
    [
      session,
      profileData,
      profileStatus,
      ready,
      recoveryInProgress,
      refetchProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
