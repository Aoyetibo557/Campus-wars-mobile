import {
  rankResults,
  sanitizeSearchTerm,
  type UniversityRow,
} from "@/lib/universities";

// The lib imports supabase for the query hook — pure helpers under test
// don't touch it, but the import alone pulls in AsyncStorage (null in Jest).
jest.mock("@/lib/supabase", () => ({ supabase: {} }));

const row = (name: string, short: string | null = null): UniversityRow => ({
  id: name,
  name,
  short_name: short,
  state: "VA",
  country: "US",
  email_domains: [],
});

describe("sanitizeSearchTerm (amendment 1 — no or() injection)", () => {
  it("passes plain queries through", () => {
    expect(sanitizeSearchTerm("university of")).toBe("university of");
  });

  it("neutralizes filter-syntax characters", () => {
    // `,` `(` `)` are or() syntax; `%` `_` `"` `\` `*` are wildcards/escape —
    // each becomes a safe ilike wildcard, so a hostile query can only widen
    // the match, never reshape the filter.
    expect(sanitizeSearchTerm('a),(b"%')).toBe("a%b");
    expect(sanitizeSearchTerm("(x)*")).toBe("x");
    expect(sanitizeSearchTerm("a,b")).toBe("a%b");
  });

  it("returns empty for punctuation-only queries", () => {
    expect(sanitizeSearchTerm("(,)")).toBe("");
    expect(sanitizeSearchTerm("")).toBe("");
  });
});

describe("rankResults (amendment 4)", () => {
  const rows = [
    row("Eastern State College"),
    row("University of Virginia", "UVA"),
    row("State College of Florida"),
    row("Colorado State University", "CSU"),
    row("Virginia Polytechnic Institute and State University", "VT"),
    row("State University of New York", "SUNY"),
  ];

  it('exact short_name match ranks first ("uva")', () => {
    const ranked = rankResults(rows, "uva");
    expect(ranked[0].short_name).toBe("UVA");
  });

  it('word-start beats substring-only ("state")', () => {
    const ranked = rankResults(rows, "state");
    const i = (n: string) => ranked.findIndex((r) => r.name === n);
    // "State College…", "State University…" have 'state' as a word start;
    // "Eastern State College" has it mid-word — all rank 2+ but
    // name-startswith comes first.
    expect(i("State College of Florida")).toBeLessThan(
      i("Eastern State College"),
    );
    expect(i("State University of New York")).toBeLessThan(
      i("Eastern State College"),
    );
  });

  it('name-prefix beats word-start ("university of")', () => {
    const ranked = rankResults(rows, "university of");
    expect(ranked[0].name).toBe("University of Virginia");
  });

  it("empty query → empty result", () => {
    expect(rankResults(rows, "  ")).toEqual([]);
  });
});
