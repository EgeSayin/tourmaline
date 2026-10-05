"use client";

import { startTransition, useActionState, useState } from "react";
import { FormInput, FormSelect, FormStateProvider } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { itemToFormValues, type Repeat } from "@/lib/item-form";
import { type Item, PRIORITIES } from "@/lib/items";
import type { TimeZone } from "@/lib/time-zone";
import { createItemAction, type ItemFormState, updateItemAction } from "@/server/items/actions";
import { DeleteItemButton } from "./delete-item-button";
import { FixedItemFields } from "./fixed-item-fields";
import { FlexibleItemFields } from "./flexible-item-fields";
import { RepeatFields } from "./repeat-fields";
import { SkipOccurrenceButton } from "./skip-occurrence-button";
import { TimingSwitch } from "./timing-switch";

const PRIORITY_OPTIONS = PRIORITIES.map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));

/** Adds a new item, or edits `item` when given, offering to skip its occurrence `occurrenceId` if given. */
export function ItemForm({
  item,
  occurrenceId,
  timeZone,
  onDone,
}: {
  item?: Item;
  occurrenceId?: string;
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
          <FormInput
            name="title"
            label="Title"
            autoFocus={!item}
            placeholder={timing === "fixed" ? "CS 101 lecture" : "Physics homework"}
          />
          <FormSelect
            key={timing}
            name="priority"
            label="Priority"
            options={PRIORITY_OPTIONS}
            defaultValue={timing === "fixed" ? "mandatory" : "normal"}
          />
          {timing === "fixed" ? <FixedItemFields /> : <FlexibleItemFields repeating={repeat !== "none"} />}
          <RepeatFields repeat={repeat} onRepeatChange={setRepeat} />
        </FieldGroup>
      </FormStateProvider>

      {/* Not editable in the form yet; carried along so saving doesn't drop them. */}
      {timing === "flexible" && (
        <>
          <input type="hidden" name="minChunkMin" defaultValue={values.minChunkMin} />
          <input type="hidden" name="maxChunkMin" defaultValue={values.maxChunkMin} />
          <input type="hidden" name="spread" defaultValue={values.spread} />
        </>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Saving…" : item ? "Save changes" : "Add item"}
        </Button>
        {occurrenceId && <SkipOccurrenceButton occurrenceId={occurrenceId} onSkipped={onDone} />}
        {item && <DeleteItemButton id={item.id} onDeleted={onDone} />}
      </div>
    </form>
  );
}
