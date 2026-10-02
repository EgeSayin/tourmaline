"use client";

import { useActionState, useState } from "react";
import { FormInput, FormSelect, FormStateProvider } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { type Item, PRIORITIES } from "@/lib/items";
import { type CreateItemState, createItem } from "@/server/items/actions";
import { FixedItemFields } from "./fixed-item-fields";
import { FlexibleItemFields } from "./flexible-item-fields";
import { TimingSwitch } from "./timing-switch";

const PRIORITY_OPTIONS = PRIORITIES.map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));

export function ItemForm({ onSaved }: { onSaved: () => void }) {
  const [timing, setTiming] = useState<Item["timing"]>("flexible");
  const [state, formAction, pending] = useActionState(
    async (previous: CreateItemState, formData: FormData) => {
      const result = await createItem(previous, formData);
      if (result.status === "saved") onSaved();
      return result;
    },
    { status: "idle" },
  );
  const invalid = state.status === "invalid" ? state : null;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <TimingSwitch value={timing} onChange={setTiming} />

      <FormStateProvider values={invalid?.fields ?? {}} errors={invalid?.errors ?? {}}>
        <FieldGroup>
          <FormInput
            name="title"
            label="Title"
            autoFocus
            placeholder={timing === "fixed" ? "CS 101 lecture" : "Physics homework"}
          />
          <FormSelect
            key={timing}
            name="priority"
            label="Priority"
            options={PRIORITY_OPTIONS}
            defaultValue={timing === "fixed" ? "mandatory" : "normal"}
          />
          {timing === "fixed" ? <FixedItemFields /> : <FlexibleItemFields />}
        </FieldGroup>
      </FormStateProvider>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add item"}
      </Button>
    </form>
  );
}
