"use client";

import { useState } from "react";
import { CategorySelect } from "./category-select";
import { DeleteButton } from "@/components/forms/delete-button";
import { FormChoice, FormInput, FormSection, FormStateProvider } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { itemToFormValues, type Repeat } from "@/lib/item-form";
import type { Category } from "@/lib/categories";
import { isTask, type Item } from "@/lib/items";
import { PRIORITY_OPTIONS } from "./priority";
import type { TimeZone } from "@/lib/time/time-zone";
import { useFormAction } from "@/hooks/use-form-action";
import { createItemAction, deleteItemAction, updateItemAction } from "@/server/items/actions";
import { BufferFields, FixedTimeFields } from "./fixed-item-fields";
import { RepeatFields } from "./repeat-fields";
import { DurationField, TaskScheduleSection, TaskWindowFields, TimeOfDayField } from "./task-fields";
import { TaskDoneButton } from "./task-done-button";
import { TimingSwitch } from "./timing-switch";

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
          <FormChoice
            key={timing}
            name="priority"
            label="Priority"
            description={
              timing === "fixed"
                ? "Below mandatory, it shows as optional, with a dashed outline."
                : "When time runs out, lower priority tasks move first."
            }
            options={PRIORITY_OPTIONS}
            defaultValue={timing === "fixed" ? "mandatory" : "normal"}
          />
          {timing === "fixed" && <FormInput name="location" label="Location (optional)" />}
          {/* Before "When", whose fields depend on it; it keeps its place as the kind changes, so what's entered stays. */}
          <FormSection title="Repeat">
            <RepeatFields repeat={repeat} onRepeatChange={setRepeat} />
          </FormSection>
          <FormSection title="When">
            {timing === "fixed" ? (
              <>
                <FixedTimeFields repeats={repeat !== "none"} />
                <BufferFields />
              </>
            ) : (
              <>
                <DurationField />
                <TaskWindowFields repeat={repeat} />
                <TimeOfDayField />
              </>
            )}
          </FormSection>
          {timing === "flexible" && <TaskScheduleSection />}
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
