import { domainHint, emailMatchesDomainList } from "@/lib/email-domain";

const SINGLE = ["virginia.edu"];
const DUAL = ["cmu.edu", "andrew.cmu.edu"];

describe("emailMatchesDomainList (mirror of the DB rule)", () => {
  it("accepts an exact domain", () => {
    expect(emailMatchesDomainList("a@virginia.edu", SINGLE)).toBe(true);
  });

  it("accepts a subdomain", () => {
    expect(emailMatchesDomainList("a@cs.virginia.edu", SINGLE)).toBe(true);
  });

  it("accepts uppercase + surrounding spaces", () => {
    expect(emailMatchesDomainList("  A@Virginia.EDU ", SINGLE)).toBe(true);
  });

  it("accepts either domain of a two-domain school", () => {
    expect(emailMatchesDomainList("a@cmu.edu", DUAL)).toBe(true);
    expect(emailMatchesDomainList("a@andrew.cmu.edu", DUAL)).toBe(true);
    expect(emailMatchesDomainList("a@x.andrew.cmu.edu", DUAL)).toBe(true);
  });

  it("rejects prefix-attached lookalikes", () => {
    expect(emailMatchesDomainList("a@evilvirginia.edu", SINGLE)).toBe(false);
  });

  it("rejects suffix-attached lookalikes", () => {
    expect(emailMatchesDomainList("a@virginia.edu.evil.com", SINGLE)).toBe(
      false,
    );
  });

  it("rejects gmail.com", () => {
    expect(emailMatchesDomainList("a@gmail.com", SINGLE)).toBe(false);
  });

  it("rejects a trailing dot", () => {
    expect(emailMatchesDomainList("a@virginia.edu.", SINGLE)).toBe(false);
  });

  it("rejects missing / malformed input", () => {
    expect(emailMatchesDomainList("not-an-email", SINGLE)).toBe(false);
    expect(emailMatchesDomainList("", SINGLE)).toBe(false);
    expect(emailMatchesDomainList("a@virginia.edu", [])).toBe(false);
  });
});

describe("domainHint", () => {
  it("shows one domain plainly", () => {
    expect(domainHint(["virginia.edu"])).toBe("virginia.edu");
  });
  it("shows two domains", () => {
    expect(domainHint(["cmu.edu", "andrew.cmu.edu"])).toBe(
      "cmu.edu, andrew.cmu.edu",
    );
  });
  it("caps at two with +N more", () => {
    expect(domainHint(["a.edu", "b.edu", "c.edu", "d.edu"])).toBe(
      "a.edu, b.edu +2 more",
    );
  });
  it("empty list → empty hint", () => {
    expect(domainHint([])).toBe("");
  });
});
