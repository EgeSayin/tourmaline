"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SegmentedControl } from "@/components/controls/segmented-control";
import { DeleteButton } from "@/components/forms/delete-button";
import { FormInput, FormStateProvider, useClearFormErrors, useFormErrors } from "@/components/forms/form-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldError, FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  CATEGORY_COLOR_PATTERN,
  CATEGORY_NAME_MAX,
  CATEGORY_PRESETS,
  type CategoryColor,
  NEW_CATEGORY_COLOR,
} from "@/lib/categories";
import { cn } from "@/lib/utils";
import { useFormAction } from "@/hooks/use-form-action";
import { deleteCategoryAction, saveCategoryAction } from "@/server/categories/actions";
import type { CategoryEntry } from "@/server/categories/category-list";
import { CategoryDot } from "./category-dot";

const isColor = (value: string | undefined): value is CategoryColor =>
  value !== undefined && CATEGORY_COLOR_PATTERN.test(value);

const SWATCH_RING =
  "flex size-8 items-center justify-center rounded-full ring-ring transition hover:ring-2 hover:ring-ring/40 focus-visible:outline-none focus-visible:ring-2";

export function CategoryEditor({ category }: { category: CategoryEntry | null }) {
  const router = useRouter();
  const close = () => router.push("/categories");
  const { values, errors, pending, onSubmit } = useFormAction(
    saveCategoryAction.bind(null, category?.id ?? null),
    category ? { name: category.name, color: category.color } : {},
    close,
  );
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
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <FormStateProvider values={values} errors={errors}>
          <FieldGroup>
            <FormInput name="name" label="Name" autoFocus={!category} maxLength={CATEGORY_NAME_MAX} />
            <ColorField color={color} onChange={setColor} />
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

function ColorField({ color, onChange }: { color: CategoryColor; onChange: (color: CategoryColor) => void }) {
  const messages = useFormErrors("color");
  const clearErrors = useClearFormErrors("color");
  const presets = Object.entries(CATEGORY_PRESETS);
  const isCustom = !presets.some(([, value]) => value === color);
  const change = (next: CategoryColor) => {
    clearErrors();
    onChange(next);
  };

  return (
    <FieldSet data-invalid={messages ? true : undefined} className="gap-2">
      <FieldLegend variant="label">Colour</FieldLegend>
      <input type="hidden" name="color" value={color} />
      <SegmentedControl
        label="Colour"
        value={isCustom ? undefined : color}
        onChange={change}
        options={presets.map(([label, value]) => ({
          value,
          label,
          content: <CategoryDot color={value} className="size-6" />,
        }))}
        className="flex flex-wrap items-center gap-2"
        optionClassName={cn(SWATCH_RING, "aria-checked:ring-2 aria-checked:ring-ring")}
      >
        <label className={cn(SWATCH_RING, "relative has-focus-visible:ring-2", isCustom && "ring-2")}>
          {isCustom ? (
            <CategoryDot color={color} className="size-6" />
          ) : (
            <span
              aria-hidden
              className="block size-6 rounded-full bg-[conic-gradient(#ef4444,#facc15,#22c55e,#3b82f6,#a855f7,#ef4444)]"
            />
          )}
          {/* Invisible over the swatch: browsers draw the input itself in their own shape. */}
          <input
            type="color"
            aria-label="Custom colour"
            value={color}
            onChange={(event) => change(event.target.value.toLowerCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
      </SegmentedControl>
      <FieldError errors={messages?.map((message) => ({ message }))} />
    </FieldSet>
  );
}
