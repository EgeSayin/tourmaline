import { and, asc, eq, sql } from "drizzle-orm";
import type { Category, CategoryVisibility, NewCategory } from "@/lib/categories";
import { ownedBy, type WorkspaceTx } from "./workspace-transaction";
import { categories, settings } from "./schema";

/** Every category, sorted by name. */
export async function loadCategories(tx: WorkspaceTx): Promise<Category[]> {
  return tx
    .select({ id: categories.id, name: categories.name, color: categories.color })
    .from(categories)
    .where(ownedBy(tx, categories))
    .orderBy(asc(categories.name));
}

/** Throws if another category in the workspace has the same name. */
export async function insertCategory(tx: WorkspaceTx, category: NewCategory): Promise<string> {
  const [{ id }] = await tx
    .insert(categories)
    .values({ ...category, workspaceId: tx.workspaceId })
    .returning({ id: categories.id });
  return id;
}

/** Throws if another category in the workspace has the same name. */
export async function updateCategory(tx: WorkspaceTx, id: string, category: NewCategory): Promise<void> {
  await tx
    .update(categories)
    .set(category)
    .where(and(ownedBy(tx, categories), eq(categories.id, id)));
}

export async function deleteCategory(tx: WorkspaceTx, id: string): Promise<boolean> {
  const deleted = await tx
    .delete(categories)
    .where(and(ownedBy(tx, categories), eq(categories.id, id)))
    .returning({ id: categories.id });
  await tx
    .update(settings)
    .set({ hiddenCategoryIds: sql`array_remove(${settings.hiddenCategoryIds}, ${id}::uuid)` })
    .where(ownedBy(tx, settings));
  return deleted.length > 0;
}

export async function loadCategoryVisibility(tx: WorkspaceTx): Promise<CategoryVisibility> {
  const [row] = await tx
    .select({ hiddenIds: settings.hiddenCategoryIds, uncategorizedHidden: settings.uncategorizedHidden })
    .from(settings)
    .where(ownedBy(tx, settings));
  return row;
}

/** Hides only the workspace's own categories, so another's id or a deleted one is left out. */
export async function saveCategoryVisibility(
  tx: WorkspaceTx,
  { hiddenIds, uncategorizedHidden }: CategoryVisibility,
): Promise<void> {
  const own = new Set((await loadCategories(tx)).map((category) => category.id));
  await tx
    .update(settings)
    .set({ hiddenCategoryIds: hiddenIds.filter((id) => own.has(id)), uncategorizedHidden })
    .where(ownedBy(tx, settings));
}
