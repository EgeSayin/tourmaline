import "server-only";
import { z } from "zod";
import { type Category, CATEGORY_COLORS, CATEGORY_NAME_MAX, type NewCategory } from "@/lib/categories";

export type CategoryFormErrors = Partial<Record<string, string[]>>;

export type ParsedCategoryForm = { ok: true; category: NewCategory } | { ok: false; errors: CategoryFormErrors };

const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(CATEGORY_NAME_MAX, `Keep it to ${CATEGORY_NAME_MAX} characters`),
  color: z.enum(CATEGORY_COLORS, "Pick a colour"),
});

/**
 * Validates submitted fields for the category `id` (`null` for a new one). Its trimmed name must differ, ignoring
 * case, from every other category's in `existing`.
 */
export function parseCategoryForm(
  fields: Record<string, unknown>,
  existing: Category[],
  id: string | null,
): ParsedCategoryForm {
  const parsed = categoryFormSchema.safeParse(fields);
  if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors };

  const name = parsed.data.name.toLowerCase();
  if (existing.some((category) => category.id !== id && category.name.toLowerCase() === name)) {
    return { ok: false, errors: { name: ["Another category has this name"] } };
  }
  return { ok: true, category: parsed.data };
}
