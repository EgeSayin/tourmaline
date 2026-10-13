"use client";

import { useRef } from "react";
import { FormDurationInput, FormInput, useFormValue } from "@/components/forms/form-fields";
import { FieldDescription } from "@/components/ui/field";
import { fromTimeInputValue, MINUTES_PER_DAY, toTimeInputValue } from "@/lib/time/time-of-day";

const BUFFER_PRESETS = [10, 15, 30];

/** A fixed item's date and times, before its repeat rule. */
export function FixedTimeFields() {
  const previousStart = useRef(useFormValue("startTime") ?? "");

  // Moving the start moves the end with it, keeping the length.
  const keepLength = (event: React.FormEvent<HTMLInputElement>) => {
    const start = event.currentTarget.value;
    const end = event.currentTarget.form?.elements.namedItem("endTime") as HTMLInputElement | null;
    if (end?.value && start && previousStart.current) {
      const shift = fromTimeInputValue(start) - fromTimeInputValue(previousStart.current);
      end.value = toTimeInputValue((fromTimeInputValue(end.value) + shift + MINUTES_PER_DAY) % MINUTES_PER_DAY);
    }
    previousStart.current = start;
  };

  return (
    <>
      <FormInput name="date" label="Date" type="date" placeholder="Not set" />
      <div className="grid grid-cols-2 gap-4">
        <FormInput name="startTime" label="Starts" type="time" placeholder="Not set" onInput={keepLength} />
        <FormInput
          name="endTime"
          label="Ends"
          type="time"
          placeholder="Not set"
          description="Before the start means the next day."
        />
      </div>
    </>
  );
}

/** The time kept free around a fixed item, after its repeat rule. */
export function BufferFields() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormDurationInput name="bufferBeforeMin" label="Free before" placeholder="0m" presets={BUFFER_PRESETS} />
        <FormDurationInput name="bufferAfterMin" label="Free after" placeholder="0m" presets={BUFFER_PRESETS} />
      </div>
      <FieldDescription>Kept free of tasks, for example to get there and back.</FieldDescription>
    </>
  );
}
