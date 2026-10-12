import type { Category } from "@/lib/categories";
import type { Item } from "@/lib/items";
import { loadCategories } from "@/server/db/categories-repository";
import { loadItems } from "@/server/db/items-repository";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";

export interface CategoryEntry extends Category {
  itemCount: number;
}

export function listCategories(categories: Category[], items: Item[]): CategoryEntry[] {
  const counts = new Map<string, number>();
  for (const { categoryId } of items) {
    if (categoryId) counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
  }
  return categories.map((category) => ({ ...category, itemCount: counts.get(category.id) ?? 0 }));
}

export async function loadCategoryList(tx: WorkspaceTx): Promise<CategoryEntry[]> {
  const [categories, items] = await Promise.all([loadCategories(tx), loadItems(tx)]);
  return listCategories(categories, items);
}
