import { asc, eq } from "drizzle-orm";
import type { Category, NewCategory } from "@/lib/categories";
import type { Database, Transaction } from "./connection";
import { categories } from "./schema";

/** Every category, sorted by name. */
export async function loadCategories(executor: Database | Transaction): Promise<Category[]> {
  return executor
    .select({ id: categories.id, name: categories.name, color: categories.color })
    .from(categories)
    .orderBy(asc(categories.name));
}

/** Throws if another category has the same name. */
export async function insertCategory(executor: Database | Transaction, category: NewCategory): Promise<string> {
  const [{ id }] = await executor.insert(categories).values(category).returning({ id: categories.id });
  return id;
}

/** Returns `false` if no category has `id`. Throws if another category has the same name. */
export async function updateCategory(
  executor: Database | Transaction,
  id: string,
  category: NewCategory,
): Promise<boolean> {
  const updated = await executor
    .update(categories)
    .set(category)
    .where(eq(categories.id, id))
    .returning({ id: categories.id });
  return updated.length > 0;
}

/** Its items are kept, without a category. Returns `false` if no category has `id`. */
export async function deleteCategory(executor: Database | Transaction, id: string): Promise<boolean> {
  const deleted = await executor.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
  return deleted.length > 0;
}
