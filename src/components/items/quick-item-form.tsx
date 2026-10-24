"use client";

import { FormChoice, FormDateTimeInput, FormInput, FormStateProvider } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import type { Category } from "@/lib/categories";
import { itemToFormValues } from "@/lib/item-form";
import { isFixed, isTask, type Item } from "@/lib/items";
import type { TimeZone } from "@/lib/time/time-zone";
import { useFormAction } from "@/hooks/use-form-action";
import { updateItemAction } from "@/server/items/actions";
import { CategorySelect } from "./category-select";
import { FixedTimeFields } from "./fixed-item-fields";
import { PRIORITY_OPTIONS } from "./priority";
import { DurationField } from "./task-fields";

const FIXED_FIELDS = ["title", "category", "location", "date", "startTime", "endTime"];
const TASK_FIELDS = ["title", "category", "priority", "durationMin", "deadline"];

/**
 * The fields of `item` most often changed; the rest are submitted as they are, so it saves like the full editor, from
 * `item`'s first date on. A repeating task has no due date to show: each occurrence's comes from its rule.
 */
export function QuickItemForm({
  item,
  categories,
  timeZone,
  onDone,
}: {
  item: Item;
  categories: Category[];
  timeZone: TimeZone;
  onDone: () => void;
}) {
  const initial = itemToFormValues(item, timeZone);
  const { values, errors, pending, onSubmit } = useFormAction(updateItemAction.bind(null, item.id), initial, onDone);
  const fixed = isFixed(item);
  const shown = fixed ? FIXED_FIELDS : TASK_FIELDS.filter((name) => name !== "deadline" || !item.recurrence);
  // A rule a hidden field breaks, such as a time of day the new duration no longer fits.
  const hiddenErrors = Object.entries(errors).flatMap(([name, messages]) => (shown.includes(name) ? [] : messages!));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {Object.entries(initial).map(
        ([name, value]) => !shown.includes(name) && <input key={name} type="hidden" name={name} value={value} />,
      )}
      <FormStateProvider values={values} errors={errors}>
        <FieldGroup>
          <FormInput name="title" label="Title" />
          <CategorySelect categories={categories} />
          {fixed ? (
            <>
              <FormInput name="location" label="Location (optional)" />
              <FixedTimeFields repeats={item.recurrence !== null} />
            </>
          ) : (
            <>
              <FormChoice name="priority" label="Priority" options={PRIORITY_OPTIONS} defaultValue="normal" />
              <DurationField upTo={isTask(item) && item.upTo} />
              {!item.recurrence && <FormDateTimeInput name="deadline" label="Due" />}
            </>
          )}
        </FieldGroup>
      </FormStateProvider>
      <FieldError errors={hiddenErrors.map((message) => ({ message }))} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
