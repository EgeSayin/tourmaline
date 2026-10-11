"use client";

import { startTransition, useActionState, useState } from "react";
import { CategorySelect } from "./category-select";
import { DeleteButton } from "@/components/forms/delete-button";
import { FormInput, FormSelect, FormStateProvider } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { itemToFormValues, type Repeat } from "@/lib/item-form";
import type { Category } from "@/lib/categories";
import { isTask, type Item, PRIORITIES, type Priority } from "@/lib/items";
import type { TimeZone } from "@/lib/time/time-zone";
import { createItemAction, deleteItemAction, type ItemFormState, updateItemAction } from "@/server/items/actions";
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
  const save = item ? updateItemAction.bind(null, item.id) : createItemAction;
  const [state, formAction, pending] = useActionState(
    async (previous: ItemFormState, formData: FormData) => {
      const result = await save(previous, formData);
      if (result.status === "saved") onDone();
      return result;
    },
    { status: "idle" },
  );
  const invalid = state.status === "invalid" ? state : null;
  const values = invalid?.fields ?? (item ? itemToFormValues(item, timeZone) : {});
  const [repeat, setRepeat] = useState<Repeat>(item?.recurrence?.frequency ?? "none");

  return (
    <form
      // Not `action`: React resets a form after its action, and a reset select shows its first value again.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-6"
    >
      <TimingSwitch value={timing} onChange={setTiming} />

      <FormStateProvider values={values} errors={invalid?.errors ?? {}}>
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
