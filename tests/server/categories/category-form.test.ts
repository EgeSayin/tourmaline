import { describe, expect, it } from "vitest";
import { listCategories } from "@/server/categories/category-list";
import { parseCategoryForm } from "@/server/categories/parse-category-form";
import { utc } from "../../support/intervals";
import { fixed, flexible } from "../../support/items";

const cs = { id: "cs", name: "CSC 101", color: "blue" } as const;
const health = { id: "health", name: "Health", color: "pink" } as const;

describe("categories", () => {
  it("parses a category's name and colour, rejecting a blank, long or taken name and an unknown colour", () => {
    expect(parseCategoryForm({ name: "  PHYS 201 ", color: "green" }, [cs], null)).toEqual({
      ok: true,
      category: { name: "PHYS 201", color: "green" },
    });
    // Its own name, in any case, is free.
    expect(parseCategoryForm({ name: "csc 101", color: "red" }, [cs], "cs")).toEqual({
      ok: true,
      category: { name: "csc 101", color: "red" },
    });

    const errors = (fields: Record<string, string>, id: string | null = null) => {
      const parsed = parseCategoryForm(fields, [cs, health], id);
      return parsed.ok ? {} : parsed.errors;
    };
    expect(errors({ name: "   ", color: "blue" })).toEqual({ name: ["Enter a name"] });
    expect(errors({ name: "x".repeat(41), color: "blue" })).toEqual({ name: ["Keep it to 40 characters"] });
    expect(errors({ name: "Lab", color: "gold" })).toEqual({ color: ["Pick a colour"] });
    expect(errors({ name: "csc 101", color: "blue" })).toEqual({ name: ["Another category has this name"] });
    expect(errors({ name: "HEALTH", color: "blue" }, "cs")).toEqual({ name: ["Another category has this name"] });
  });

  it("counts each category's items", () => {
    const week = utc("2026-10-05T04:00", "2026-10-12T04:00");
    const items = [
      { ...fixed("Lecture", week), categoryId: "cs" },
      { ...flexible("Homework", 60, week), categoryId: "cs" },
      { ...flexible("Gym", 60, week), categoryId: "health" },
      flexible("Groceries", 30, week),
    ];
    expect(listCategories([cs, health, { id: "empty", name: "Empty", color: "slate" }], items)).toEqual([
      { ...cs, itemCount: 2 },
      { ...health, itemCount: 1 },
      { id: "empty", name: "Empty", color: "slate", itemCount: 0 },
    ]);
  });
});
