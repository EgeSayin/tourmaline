"use client";

import { useState } from "react";
import { FormDurationInput, FormInput, FormTimeInput, useFormValue } from "@/components/forms/form-fields";
import { FieldDescription } from "@/components/ui/field";
import { dayField } from "@/lib/item-form";
import type { Weekday } from "@/lib/recurrence";
import { WEEKDAY_NAMES } from "@/lib/time/format";
import { fromTimeInputValue, MINUTES_PER_DAY, toTimeInputValue } from "@/lib/time/time-of-day";

const BUFFER_PRESETS = [10, 15, 30];

/**
 * A fixed item's date and times; a repeating item's date is its first. With `days`, each of those weekdays has its
 * own times.
 */
export function FixedTimeFields({ repeats = false, days = null }: { repeats?: boolean; days?: Weekday[] | null }) {
  return (
    <>
      <FormInput name="date" label={repeats ? "First date" : "Date"} type="date" placeholder="Not set" />
      {days ? (
        <>
          {days.map((day) => {
            const name = WEEKDAY_NAMES[day - 1];
            return (
              <StartEndFields
                key={day}
                startName={dayField("startTime", day)}
                endName={dayField("endTime", day)}
                startLabel={`${name} starts`}
                endLabel={`${name} ends`}
              />
            );
          })}
          <FieldDescription>An end before the start means the next day.</FieldDescription>
        </>
      ) : (
        <StartEndFields
          startName="startTime"
          endName="endTime"
          startLabel="Starts"
          endLabel="Ends"
          endDescription="Before the start means the next day."
        />
      )}
    </>
  );
}

/** A start and end time; moving the start moves the end with it, keeping the length. */
function StartEndFields({
  startName,
  endName,
  startLabel,
  endLabel,
  endDescription,
}: {
  startName: string;
  endName: string;
  startLabel: string;
  endLabel: string;
  endDescription?: string;
}) {
  const [start, setStart] = useState(useFormValue(startName) ?? "");
  const [end, setEnd] = useState(useFormValue(endName) ?? "");
  const isTime = (value: string) => TIME.test(value);

  const moveStart = (next: string) => {
    if (isTime(start) && isTime(next) && isTime(end)) {
      const shift = fromTimeInputValue(next) - fromTimeInputValue(start);
      setEnd(toTimeInputValue((fromTimeInputValue(end) + shift + MINUTES_PER_DAY) % MINUTES_PER_DAY));
    }
    setStart(next);
  };

  return (
    <div className="flex flex-wrap gap-4">
      <FormTimeInput name={startName} label={startLabel} value={start} onChange={moveStart} />
      <FormTimeInput name={endName} label={endLabel} value={end} onChange={setEnd} description={endDescription} />
    </div>
  );
}

const TIME = /^\d{2}:\d{2}$/;

/** The time kept free around a fixed item. */
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
