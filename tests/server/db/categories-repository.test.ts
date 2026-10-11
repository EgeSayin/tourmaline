import { describe, expect } from "vitest";
import { deleteCategory, insertCategory, loadCategories, updateCategory } from "@/server/db/categories-repository";
import { insertItem, loadItem, updateItem } from "@/server/db/items-repository";
import { dbTest as it } from "../../support/database";
import { utc } from "../../support/intervals";
import { flexible, unsaved } from "../../support/items";

describe("categories repository", { tags: ["integration", "critical"] }, () => {
  it("saves categories with unique names, sorted by name, and keeps items when one is deleted", async ({ tx }) => {
    const physics = await insertCategory(tx, { name: "PHYS 201", color: "blue" });
    const cs = await insertCategory(tx, { name: "CSC 101", color: "green" });
    expect(await loadCategories(tx)).toEqual([
      { id: cs, name: "CSC 101", color: "green" },
      { id: physics, name: "PHYS 201", color: "blue" },
    ]);

    expect(await updateCategory(tx, physics, { name: "PHYS 202", color: "purple" })).toBe(true);
    expect(await updateCategory(tx, crypto.randomUUID(), { name: "Gone", color: "red" })).toBe(false);
    await expect(
      tx.transaction((nested) => insertCategory(nested, { name: "CSC 101", color: "red" })),
    ).rejects.toThrow();

    const essay = unsaved(flexible("Essay", 60, utc("2026-10-05T04:00", "2026-10-09T21:00")));
    const essayId = await insertItem(tx, { ...essay, categoryId: cs });
    expect((await loadItem(tx, essayId))?.categoryId).toBe(cs);
    await updateItem(tx, essayId, { ...essay, categoryId: physics });
    expect((await loadItem(tx, essayId))?.categoryId).toBe(physics);

    expect(await deleteCategory(tx, physics)).toBe(true);
    expect(await deleteCategory(tx, physics)).toBe(false);
    expect(await loadCategories(tx)).toEqual([{ id: cs, name: "CSC 101", color: "green" }]);
    expect(await loadItem(tx, essayId)).toMatchObject({ title: "Essay", categoryId: null });
  });
});
