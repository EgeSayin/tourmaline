import { describe, expect, it } from "vitest";
import { ALL_CATEGORIES, matchesFilter, NO_CATEGORY } from "@/lib/categories";

describe("matchesFilter", { tags: ["unit"] }, () => {
  it("lets everything through, only items without a category, or only one category's", () => {
    const cases = [
      ["cs", ALL_CATEGORIES, true],
      [null, ALL_CATEGORIES, true],
      [null, NO_CATEGORY, true],
      ["cs", NO_CATEGORY, false],
      ["cs", "cs", true],
      ["calc", "cs", false],
      [null, "cs", false],
    ] as const;
    for (const [categoryId, filter, expected] of cases) expect(matchesFilter(categoryId, filter)).toBe(expected);
  });
});
