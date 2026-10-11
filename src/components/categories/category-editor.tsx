"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useState } from "react";
import { SegmentedControl } from "@/components/controls/segmented-control";
import { DeleteButton } from "@/components/forms/delete-button";
import { FormInput, FormStateProvider } from "@/components/forms/form-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldError, FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { CATEGORY_COLORS, CATEGORY_NAME_MAX, type CategoryColor } from "@/lib/categories";
import { type CategoryFormState, deleteCategoryAction, saveCategoryAction } from "@/server/categories/actions";
import type { CategoryEntry } from "@/server/categories/category-list";
import { CategoryDot } from "./category-dot";

const NEW_CATEGORY_COLOR: CategoryColor = "blue";

const isColor = (value: string | undefined): value is CategoryColor => CATEGORY_COLORS.includes(value as CategoryColor);

/** Edits `category`, or adds a new one without it; closing, saving or deleting goes back to the list. */
export function CategoryEditor({ category }: { category: CategoryEntry | null }) {
  const router = useRouter();
  const close = () => router.push("/categories");
  const [state, formAction, pending] = useActionState(
    async (previous: CategoryFormState, formData: FormData) => {
      const result = await saveCategoryAction(category?.id ?? null, previous, formData);
      if (result.status === "saved") close();
      return result;
    },
    { status: "idle" },
  );
  const invalid = state.status === "invalid" ? state : null;
  const values = invalid?.fields ?? (category ? { name: category.name, color: category.color } : {});
  const [color, setColor] = useState<CategoryColor>(isColor(values.color) ? values.color : NEW_CATEGORY_COLOR);
  const title = category ? "Edit category" : "New category";

  return (
    <aside aria-label={title} className="flex flex-col gap-4 overflow-y-auto p-4 md:border-l">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <Link href="/categories" aria-label="Close" className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
          <X />
        </Link>
      </div>
      <form
        // Not `action`: React resets a form after its action.
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="flex flex-col gap-6"
      >
        <FormStateProvider values={values} errors={invalid?.errors ?? {}}>
          <FieldGroup>
            <FormInput name="name" label="Name" autoFocus={!category} maxLength={CATEGORY_NAME_MAX} />
            <FieldSet data-invalid={invalid?.errors.color ? true : undefined} className="gap-2">
              <FieldLegend variant="label">Colour</FieldLegend>
              <input type="hidden" name="color" value={color} />
              <SegmentedControl
                label="Colour"
                value={color}
                onChange={setColor}
                options={CATEGORY_COLORS.map((value) => ({
                  value,
                  label: value[0].toUpperCase() + value.slice(1),
                  content: <CategoryDot color={value} className="size-6" />,
                }))}
                className="flex flex-wrap gap-2"
                optionClassName="rounded-full p-1 ring-ring transition hover:ring-2 hover:ring-ring/40 aria-checked:ring-2 aria-checked:ring-ring focus-visible:outline-none focus-visible:ring-2"
              />
              <FieldError errors={invalid?.errors.color?.map((message) => ({ message }))} />
            </FieldSet>
          </FieldGroup>
        </FormStateProvider>

        <div className="flex flex-wrap justify-between gap-2">
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? "Saving…" : category ? "Save changes" : "Add category"}
          </Button>
          {category && <DeleteButton onDelete={() => deleteCategoryAction(category.id)} onDeleted={close} />}
        </div>
        {category && category.itemCount > 0 && (
          <p className="text-sm text-muted-foreground">
            Deleting it keeps its {category.itemCount === 1 ? "item" : `${category.itemCount} items`}, without a
            category.
          </p>
        )}
      </form>
    </aside>
  );
}
