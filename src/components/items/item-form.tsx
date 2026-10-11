"use client";

import { useState } from "react";
import { CategorySelect } from "./category-select";
import { DeleteButton } from "@/components/forms/delete-button";
import { FormInput, FormSelect, FormStateProvider } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { itemToFormValues, type Repeat } from "@/lib/item-form";
import type { Category } from "@/lib/categories";
import { isTask, type Item, PRIORITIES, type Priority } from "@/lib/items";
import type { TimeZone } from "@/lib/time/time-zone";
import { useFormAction } from "@/hooks/use-form-action";
import { createItemAction, deleteItemAction, updateItemAction } from "@/server/items/actions";
import { FixedItemFields } from "./fixed-item-fields";
import { TaskFields } from "./task-fields";
import { RepeatFields } from "./repeat-fields";
import { TaskDoneButton } from "./task-done-button";
import { TimingSwitch } from "./timing-switch";

const PRIORITY_LABELS = {
  mandatory: "Mandatory",
  high: "High",
  normal: "Normal",
  low: "Low",
} satisfies Record<Priority, string>;

const PRIORITY_OPTIONS = PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }));

/** Adds a new item, or edits `item` when given. */
export function ItemForm({
  item,
  categories,
  timeZone,
  onDone,
}: {
  item?: Item;
  categories: Category[];
  timeZone: TimeZone;
  onDone: () => void;
}) {
  const [timing, setTiming] = useState<Item["timing"]>(item?.timing ?? "flexible");
  const { values, errors, pending, onSubmit } = useFormAction(
    item ? updateItemAction.bind(null, item.id) : createItemAction,
    item ? itemToFormValues(item, timeZone) : {},
    onDone,
  );
  const [repeat, setRepeat] = useState<Repeat>(item?.recurrence?.frequency ?? "none");

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <TimingSwitch value={timing} onChange={setTiming} />

      <FormStateProvider values={values} errors={errors}>
        <FieldGroup>
          <FormInput name="title" label="Title" autoFocus={!item} />
          <CategorySelect categories={categories} />
          <FormSelect
            key={timing}
            name="priority"
            label="Priority"
            options={PRIORITY_OPTIONS}
            defaultValue={timing === "fixed" ? "mandatory" : "normal"}
          />
          {timing === "fixed" ? <FixedItemFields /> : <TaskFields repeating={repeat !== "none"} />}
          <RepeatFields repeat={repeat} onRepeatChange={setRepeat} />
        </FieldGroup>
      </FormStateProvider>

      <div className="flex flex-wrap justify-between gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Saving…" : item ? "Save changes" : "Add item"}
        </Button>
        {/* A series is done one occurrence at a time, from its blocks. */}
        {item && isTask(item) && !item.recurrence && <TaskDoneButton task={item} date={null} onChanged={onDone} />}
        {item && <DeleteButton onDelete={() => deleteItemAction(item.id)} onDeleted={onDone} />}
      </div>
    </form>
  );
}
