import { and, asc, eq } from "drizzle-orm";
import type { Category, NewCategory } from "@/lib/categories";
import { ownedBy, type WorkspaceTx } from "./workspace-transaction";
import { categories } from "./schema";

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

/** Returns `false` if no category has `id`. Throws if another category in the workspace has the same name. */
export async function updateCategory(tx: WorkspaceTx, id: string, category: NewCategory): Promise<boolean> {
  const updated = await tx
    .update(categories)
    .set(category)
    .where(and(ownedBy(tx, categories), eq(categories.id, id)))
    .returning({ id: categories.id });
  return updated.length > 0;
}

export async function deleteCategory(tx: WorkspaceTx, id: string): Promise<boolean> {
  const deleted = await tx
    .delete(categories)
    .where(and(ownedBy(tx, categories), eq(categories.id, id)))
    .returning({ id: categories.id });
  return deleted.length > 0;
}
