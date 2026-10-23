import { describe, expect } from "vitest";
import { isShown } from "@/lib/categories";
import {
  deleteCategory,
  insertCategory,
  loadCategoryVisibility,
  saveCategoryVisibility,
} from "@/server/db/categories-repository";
import { createGuestWorkspace } from "@/server/db/workspaces-repository";
import { dbTest as it, savepoint } from "../../support/database";

describe("category visibility", () => {
  it("hides only the workspace's own categories, and forgets one once it's deleted", async ({ tx }) => {
    expect(await loadCategoryVisibility(tx)).toEqual({ hiddenIds: [], uncategorizedHidden: false });
    const calculus = await insertCategory(tx, { name: "Calculus", color: "#f97316" });
    const health = await insertCategory(tx, { name: "Health", color: "#22c55e" });
    const guest = await createGuestWorkspace(tx);
    const theirs = await savepoint(
      tx,
      (inner) => insertCategory(inner, { name: "Theirs", color: "#ef4444" }),
      guest.workspaceId,
    );

    await saveCategoryVisibility(tx, { hiddenIds: [calculus, health, theirs], uncategorizedHidden: true });
    const saved = await loadCategoryVisibility(tx);
    expect(saved).toEqual({ hiddenIds: [calculus, health], uncategorizedHidden: true });
    expect([calculus, null, "other"].map((id) => isShown(id, saved))).toEqual([false, false, true]);

    await deleteCategory(tx, calculus);
    expect(await loadCategoryVisibility(tx)).toEqual({ hiddenIds: [health], uncategorizedHidden: true });
  });
});
