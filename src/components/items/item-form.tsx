"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { type Item, PRIORITIES, SPREAD_STRATEGIES } from "@/lib/items";
import { type CreateItemState, createItem } from "@/server/items/actions";

const TIMING_OPTIONS = [
  { value: "flexible", label: "Find time for it" },
  { value: "fixed", label: "At a set time" },
] as const satisfies { value: Item["timing"]; label: string }[];

const SPREAD_LABELS = {
  asap: "As soon as possible",
  even: "Spread evenly",
  "just-in-time": "Close to the deadline",
};

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

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

  const values = state.status === "invalid" ? state.fields : {};
  const errors = state.status === "invalid" ? state.errors : {};

  function field(name: string, label: string, input: React.ReactNode) {
    const messages = errors[name];
    return (
      <Field data-invalid={messages ? true : undefined}>
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
        {input}
        <FieldError errors={messages?.map((message) => ({ message }))} />
      </Field>
    );
  }

  const text = (
    name: string,
    type = "text",
    props: React.ComponentProps<"input"> = {},
  ) => (
    <Input
      id={name}
      name={name}
      type={type}
      defaultValue={values[name]}
      aria-invalid={errors[name] ? true : undefined}
      {...props}
    />
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="timing" value={timing} />
      <div
        role="radiogroup"
        aria-label="Timing"
        className="grid grid-cols-2 gap-1 rounded-lg border p-1"
      >
        {TIMING_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={timing === option.value}
            variant={timing === option.value ? "secondary" : "ghost"}
            onClick={() => setTiming(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <FieldGroup>
        {field(
          "title",
          "Title",
          text("title", "text", {
            autoFocus: true,
            placeholder:
              timing === "fixed" ? "CS 101 lecture" : "Physics homework",
          }),
        )}
        {field(
          "priority",
          "Priority",
          <NativeSelect
            id="priority"
            name="priority"
            defaultValue={values.priority ?? "normal"}
          >
            {PRIORITIES.map((priority) => (
              <NativeSelectOption key={priority} value={priority}>
                {capitalize(priority)}
              </NativeSelectOption>
            ))}
          </NativeSelect>,
        )}

        {timing === "fixed" ? (
          <>
            {field("start", "Starts", text("start", "datetime-local"))}
            {field("end", "Ends", text("end", "datetime-local"))}
            {field(
              "location",
              "Location",
              text("location", "text", { placeholder: "Optional" }),
            )}
            <div className="grid grid-cols-2 gap-4">
              {field(
                "bufferBeforeMin",
                "Buffer before (min)",
                text("bufferBeforeMin", "number", { min: 0, placeholder: "0" }),
              )}
              {field(
                "bufferAfterMin",
                "Buffer after (min)",
                text("bufferAfterMin", "number", { min: 0, placeholder: "0" }),
              )}
            </div>
          </>
        ) : (
          <>
            {field(
              "durationMin",
              "Duration (min)",
              text("durationMin", "number", { min: 1, placeholder: "90" }),
            )}
            {field(
              "earliestStart",
              "Not before",
              text("earliestStart", "datetime-local"),
            )}
            {field("deadline", "Due", text("deadline", "datetime-local"))}
            {field(
              "spread",
              "Spread",
              <NativeSelect
                id="spread"
                name="spread"
                defaultValue={values.spread ?? "even"}
              >
                {SPREAD_STRATEGIES.map((spread) => (
                  <NativeSelectOption key={spread} value={spread}>
                    {SPREAD_LABELS[spread]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>,
            )}
          </>
        )}
      </FieldGroup>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add item"}
      </Button>
    </form>
  );
}
