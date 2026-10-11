import "server-only";
import type { Category } from "@/lib/categories";
import type { Item } from "@/lib/items";

export interface CategoryEntry extends Category {
  itemCount: number;
}

/** `categories` in their order, each with how many of `items` belong to it. */
export function listCategories(categories: Category[], items: Item[]): CategoryEntry[] {
  const counts = new Map<string, number>();
  for (const { categoryId } of items) {
    if (categoryId) counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
  }
  return categories.map((category) => ({ ...category, itemCount: counts.get(category.id) ?? 0 }));
}
