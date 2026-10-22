import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type UniversityRow = Pick<
  Tables<"universities">,
  "id" | "name" | "short_name" | "state" | "country" | "email_domains"
>;

export const SEARCH_LIMIT = 50;
const DEBOUNCE_MS = 250;
const SHOWN = 20;

export function useDebouncedValue<T>(value: T, ms = DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/**
 * PostgREST `or()` safety (amendment 1): `,` `(` `)` `*` `%` `_` `"` `\`
 * are filter-syntax or ilike-wildcard characters. Replacing each run with
 * a literal `%` wildcard keeps matching forgiving ("california, berkeley"
 * → "california% berkeley") and makes injection impossible — anything the
 * user types can only widen, never reshape, the filter.
 */
export function sanitizeSearchTerm(input: string): string {
  return input
    .replace(/[,()*%_"\\]+/g, "%")
    .replace(/%+/g, "%")
    .replace(/^%|%$/g, "")
    .trim();
}

export type UniversitySearchResult = {
  exact: UniversityRow[];
  startsWith: UniversityRow[];
  wordStart: UniversityRow[];
  rest: UniversityRow[];
};

/** Ranking (amendment 4): exact short_name → name-starts-with → word-start. */
export function rankResults(
  rows: UniversityRow[],
  query: string,
): UniversityRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = (n: string) => n.toLowerCase().split(/\s+/);
  const rank = (r: UniversityRow): number => {
    if (r.short_name?.toLowerCase() === q) return 0;
    if (r.name.toLowerCase().startsWith(q)) return 1;
    if (words(r.name).some((w) => w.startsWith(q))) return 2;
    return 3;
  };
  return rows
    .map((r) => ({ r, k: rank(r) }))
    .sort((a, b) => a.k - b.k || a.r.name.localeCompare(b.r.name))
    .map(({ r }) => r);
}

async function searchUniversities(query: string): Promise<UniversityRow[]> {
  const safe = sanitizeSearchTerm(query);
  if (!safe) return [];
  const pattern = `%${safe}%`;
  const { data, error } = await supabase
    .from("universities")
    .select("id, name, short_name, state, country, email_domains")
    .or(`name.ilike.${pattern},short_name.ilike.${pattern}`)
    .order("name")
    .limit(SEARCH_LIMIT);
  if (error) throw error;
  return rankResults(data ?? [], query).slice(0, SHOWN);
}

export function useUniversitySearch(query: string) {
  const safe = sanitizeSearchTerm(query);
  return useQuery({
    queryKey: ["university-search", safe],
    queryFn: () => searchUniversities(query),
    enabled: safe.length >= 2,
    staleTime: 60_000,
  });
}
