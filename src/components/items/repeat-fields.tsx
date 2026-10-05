import { FormInput, FormSelect, FormToggleGroup } from "@/components/forms/form-fields";
import { type Repeat, REPEAT_OPTIONS } from "@/lib/item-form";
import { WEEKDAYS } from "@/lib/recurrence";
import { WEEKDAY_NAMES } from "@/lib/time/format";

const REPEAT_LABELS = { none: "Doesn't repeat", daily: "Daily", weekly: "Weekly" } satisfies Record<Repeat, string>;

const WEEKDAY_OPTIONS = WEEKDAYS.map((day) => ({ value: String(day), label: WEEKDAY_NAMES[day - 1] }));

export function RepeatFields({ repeat, onRepeatChange }: { repeat: Repeat; onRepeatChange: (repeat: Repeat) => void }) {
  return (
    <>
      <FormSelect
        name="repeat"
        label="Repeat"
        options={REPEAT_OPTIONS.map((value) => ({ value, label: REPEAT_LABELS[value] }))}
        defaultValue="none"
        onValueChange={(value) => onRepeatChange(value as Repeat)}
      />
      {repeat === "weekly" && <FormToggleGroup name="weekdays" label="On" options={WEEKDAY_OPTIONS} />}
      {repeat !== "none" && (
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            name="interval"
            label={repeat === "daily" ? "Every (days)" : "Every (weeks)"}
            type="number"
            min={1}
            max={99}
            placeholder="1"
          />
          <FormInput name="until" label="Until" type="date" description="Leave empty to repeat forever." />
        </div>
      )}
    </>
  );
}
