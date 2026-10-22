import { useMutation, useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type MyUniversity = Pick<
  Tables<"universities">,
  "id" | "name" | "short_name"
>;

/** Substring of the message raised by profiles_check_display_name —
 *  migration 20261010003814_functions_triggers.sql. A unit test asserts
 *  this marker exists in the migration so the two never drift. */
export const PROFANITY_MARKER = "display_name is not allowed";

export const NAME_RULES_COPY = "Name must be 2–20 characters.";

/** Postgres codes that reach the client through PostgREST. */
const CHECK_VIOLATION = "23514"; // check constraint
const RAISE_EXCEPTION = "P0001"; // raise exception

export function mapOnboardingError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null | undefined;
  const code = e?.code ?? "";
  const message = (e?.message ?? "").toLowerCase();

  if (code === RAISE_EXCEPTION && message.includes(PROFANITY_MARKER)) {
    return "That name isn't allowed. Try a different one.";
  }
  if (
    code === CHECK_VIOLATION ||
    message.includes("profiles_display_name_check")
  ) {
    return NAME_RULES_COPY;
  }
  if (
    message.includes("failed to fetch") ||
    message.includes("network request failed")
  ) {
    return "No connection. Check your internet and try again.";
  }
  return "Something went wrong. Please try again.";
}

/** The signed-in user's school for the greeting — non-blocking by design:
 *  a slow or failed load must never gate the name form. */
export function useMyUniversity(universityId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-university", universityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("universities")
        .select("id, name, short_name")
        .eq("id", universityId!)
        .single();
      if (error) throw error;
      return data as MyUniversity;
    },
    enabled: !!universityId,
    staleTime: Infinity,
    retry: 1,
  });
}

/**
 * Calls complete_onboarding (server trims, checks length + profanity,
 * stamps onboarded_at once). Deliberately does NOT invalidate the profile
 * query — the celebration stays on screen until the user taps the CTA,
 * which then refreshes the profile so the route guard moves them.
 */
export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: async (displayName: string) => {
      const { error } = await supabase.rpc("complete_onboarding", {
        p_display_name: displayName,
      });
      if (error) throw error;
    },
  });
}
