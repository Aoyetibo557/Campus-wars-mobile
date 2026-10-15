import {
  isCompleteCode,
  isValidEmail,
  normalizeEmail,
  passwordError,
} from "@/lib/validation";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Anu@Uni.EDU ")).toBe("anu@uni.edu");
  });
});

describe("isValidEmail", () => {
  it.each(["a@b.co", "student@university.edu", " x@y.io "])(
    "accepts %s",
    (e) => expect(isValidEmail(e)).toBe(true),
  );
  it.each(["", "not-an-email", "a@b", "@x.com", "a b@c.com"])(
    "rejects %s",
    (e) => expect(isValidEmail(e)).toBe(false),
  );
});

describe("passwordError", () => {
  it("rejects under 8 chars", () => {
    expect(passwordError("1234567")).toMatch(/8/);
    expect(passwordError("")).toMatch(/8/);
  });
  it("accepts 8+ chars", () => {
    expect(passwordError("12345678")).toBeNull();
    expect(passwordError("a much longer passphrase")).toBeNull();
  });
});

describe("isCompleteCode", () => {
  it("accepts exactly 6 digits", () => {
    expect(isCompleteCode("123456")).toBe(true);
  });
  it.each(["12345", "1234567", "abcdef", "12 456"])("rejects %s", (c) =>
    expect(isCompleteCode(c)).toBe(false),
  );
});
