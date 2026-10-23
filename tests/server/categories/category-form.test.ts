import { describe, expect, it } from "vitest";
import { parseCategoryForm } from "@/server/categories/parse-category-form";

const cs = { id: "cs", name: "CSC 101", color: "#3b82f6" };
const health = { id: "health", name: "Health", color: "#ec4899" };

describe("categories", () => {
  it("parses a category's name and colour, rejecting a blank, long or taken name and a colour that is not a hex code", () => {
    expect(parseCategoryForm({ name: "  PHYS 201 ", color: "#22C55E" }, [cs], null)).toEqual({
      ok: true,
      category: { name: "PHYS 201", color: "#22c55e" },
    });
    // Its own name, in any case, is free.
    expect(parseCategoryForm({ name: "csc 101", color: "#ef4444" }, [cs], "cs")).toEqual({
      ok: true,
      category: { name: "csc 101", color: "#ef4444" },
    });

    const errors = (fields: Record<string, string>, id: string | null = null) => {
      const parsed = parseCategoryForm(fields, [cs, health], id);
      return parsed.ok ? {} : parsed.errors;
    };
    expect(errors({ name: "   ", color: "#3b82f6" })).toEqual({ name: ["Enter a name"] });
    expect(errors({ name: "x".repeat(41), color: "#3b82f6" })).toEqual({ name: ["Keep it to 40 characters"] });
    expect(errors({ name: "Lab", color: "gold" })).toEqual({ color: ["Pick a colour"] });
    expect(errors({ name: "Lab", color: "#3b82f" })).toEqual({ color: ["Pick a colour"] });
    expect(errors({ name: "csc 101", color: "#3b82f6" })).toEqual({ name: ["Another category has this name"] });
    expect(errors({ name: "HEALTH", color: "#3b82f6" }, "cs")).toEqual({ name: ["Another category has this name"] });
  });
});
