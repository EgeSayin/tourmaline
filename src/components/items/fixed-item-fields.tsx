"use client";

import { useState } from "react";
import { FormDurationInput, FormInput, FormTimeInput, useFormValue } from "@/components/forms/form-fields";
import { FieldDescription } from "@/components/ui/field";
import { fromTimeInputValue, MINUTES_PER_DAY, toTimeInputValue } from "@/lib/time/time-of-day";

const BUFFER_PRESETS = [10, 15, 30];

/** A fixed item's date and times, before its repeat rule. */
export function FixedTimeFields() {
  const [start, setStart] = useState(useFormValue("startTime") ?? "");
  const [end, setEnd] = useState(useFormValue("endTime") ?? "");
  const isTime = (value: string) => TIME.test(value);

  // Moving the start moves the end with it, keeping the length.
  const moveStart = (next: string) => {
    if (isTime(start) && isTime(next) && isTime(end)) {
      const shift = fromTimeInputValue(next) - fromTimeInputValue(start);
      setEnd(toTimeInputValue((fromTimeInputValue(end) + shift + MINUTES_PER_DAY) % MINUTES_PER_DAY));
    }
    setStart(next);
  };

  return (
    <>
      <FormInput name="date" label="Date" type="date" placeholder="Not set" />
      <div className="flex flex-wrap gap-4">
        <FormTimeInput name="startTime" label="Starts" value={start} onChange={moveStart} />
        <FormTimeInput
          name="endTime"
          label="Ends"
          value={end}
          onChange={setEnd}
          description="Before the start means the next day."
        />
      </div>
    </>
  );
}

const TIME = /^\d{2}:\d{2}$/;

/** The time kept free around a fixed item, after its repeat rule. */
export function BufferFields() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormDurationInput name="bufferBeforeMin" label="Free before" presets={BUFFER_PRESETS} />
        <FormDurationInput name="bufferAfterMin" label="Free after" presets={BUFFER_PRESETS} />
      </div>
      <FieldDescription>Kept free of tasks, for example to get there and back.</FieldDescription>
    </>
  );
}
