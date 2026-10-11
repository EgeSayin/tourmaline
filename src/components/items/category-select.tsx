"use client";

import { useState } from "react";
import { CategoryDot } from "@/components/categories/category-dot";
import { FormSelect, useFormValue } from "@/components/forms/form-fields";
import type { Category } from "@/lib/categories";

/** Picks the item's category, or none, showing the picked one's colour beside the field. */
export function CategorySelect({ categories }: { categories: Category[] }) {
  const [picked, setPicked] = useState(useFormValue("category") ?? "");
  const color = categories.find((category) => category.id === picked)?.color;

  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <FormSelect
          name="category"
          label="Category"
          defaultValue=""
          options={[{ value: "", label: "None" }, ...categories.map(({ id, name }) => ({ value: id, label: name }))]}
          onValueChange={setPicked}
        />
      </div>
      <span className="flex h-8 w-4 shrink-0 items-center justify-center">
        {color && <CategoryDot color={color} className="size-4" />}
      </span>
    </div>
  );
}
