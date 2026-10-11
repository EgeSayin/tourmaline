"use server";

import "server-only";
import { refresh } from "next/cache";
import { z } from "zod";
import { deleteCategory, insertCategory, loadCategories, updateCategory } from "@/server/db/categories-repository";
import { db } from "@/server/db/client";
import { type CategoryFormErrors, parseCategoryForm } from "./parse-category-form";

export type CategoryFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "invalid"; errors: CategoryFormErrors; fields: Record<string, string> };

const categoryId = z.uuid();

/** Adds a category, or with `id` renames and recolours that one. */
export async function saveCategoryAction(
  id: string | null,
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const validId = id === null ? null : categoryId.parse(id);
  const fields = Object.fromEntries([...formData].map(([key, value]) => [key, String(value)]));
  const state = await db.transaction(async (tx): Promise<CategoryFormState> => {
    const parsed = parseCategoryForm(fields, await loadCategories(tx), validId);
    if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };
    if (validId === null) await insertCategory(tx, parsed.category);
    else if (!(await updateCategory(tx, validId, parsed.category))) throw new Error(`Category ${validId} not found`);
    return { status: "saved" };
  });
  if (state.status === "saved") refresh();
  return state;
}

/** Deletes the category; its items stay, without one. */
export async function deleteCategoryAction(id: string): Promise<void> {
  const validId = categoryId.parse(id);
  if (!(await deleteCategory(db, validId))) throw new Error(`Category ${validId} not found`);
  refresh();
}
