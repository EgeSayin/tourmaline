import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("test setup", () => {
  it("runs tests from tests/ and resolves the @/ alias", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
