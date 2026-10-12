import { cn } from "@/lib/utils";

describe("cn", () => {
  it("keeps non-conflicting classes, including custom token classes", () => {
    expect(cn("text-sm", "text-text")).toBe("text-sm text-text");
  });

  it("keeps only the last conflicting color token", () => {
    expect(cn("text-text", "text-danger")).toBe("text-danger");
    expect(cn("bg-surface", "bg-surface-raised")).toBe("bg-surface-raised");
  });

  it("drops falsy conditionals", () => {
    const error = false;
    expect(cn("px-4", error && "border-danger", "py-2")).toBe("px-4 py-2");
  });
});
