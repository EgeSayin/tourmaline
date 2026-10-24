import { FormDurationInput, FormInput, FormSelect, FormToggleGroup } from "@/components/forms/form-fields";
import { type Repeat, REPEAT_OPTIONS } from "@/lib/item-form";
import { WEEKDAYS } from "@/lib/recurrence";
import { WEEKDAY_NAMES } from "@/lib/time/format";

const REPEAT_LABELS = { none: "Doesn't repeat", daily: "Daily", weekly: "Weekly" } satisfies Record<Repeat, string>;

const WEEKDAY_OPTIONS = WEEKDAYS.map((day) => ({ value: String(day), label: WEEKDAY_NAMES[day - 1] }));

interface RepeatProps {
  repeat: Repeat;
  onRepeatChange: (repeat: Repeat) => void;
  /** Whether to offer stopping after a total time, as a task can. */
  total?: boolean;
}

/** How often an item repeats, with the rule's own fields right under it once it does. */
export function RepeatFields({ repeat, onRepeatChange, total = false }: RepeatProps) {
  return (
    <>
      <FormSelect
        name="repeat"
        label="How often"
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
          <FormInput
            name="until"
            clearable
            label="Until"
            type="date"
            placeholder="Forever"
            description="Leave empty to repeat forever."
          />
        </div>
      )}
      {repeat !== "none" && total && (
        <FormDurationInput
          name="totalMin"
          label="Stop after a total of"
          description="The series ends once its blocks add up to this much; missed ones don't count. Leave empty for no limit."
        />
      )}
    </>
  );
}
