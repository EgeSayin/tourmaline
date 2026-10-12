"use server";

import { changeWorkspace } from "@/server/workspaces/current-workspace";
import { type FormState, formFields } from "@/lib/form-state";
import { z } from "zod";
import { deleteCategory, insertCategory, loadCategories, updateCategory } from "@/server/db/categories-repository";
import { parseCategoryForm } from "./parse-category-form";

const categoryId = z.uuid();

// A category another tab deleted meanwhile is left alone: the refreshed page shows it gone.

export async function saveCategoryAction(
  id: string | null,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const validId = id === null ? null : categoryId.parse(id);
  const fields = formFields(formData);
  return changeWorkspace(
    async (tx): Promise<FormState> => {
      const parsed = parseCategoryForm(fields, await loadCategories(tx), validId);
      if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };
      if (validId === null) await insertCategory(tx, parsed.category);
      else await updateCategory(tx, validId, parsed.category);
      return { status: "saved" };
    },
    { replan: false },
  );
}

export async function deleteCategoryAction(id: string): Promise<void> {
  const validId = categoryId.parse(id);
  await changeWorkspace((tx) => deleteCategory(tx, validId), { replan: false });
}
