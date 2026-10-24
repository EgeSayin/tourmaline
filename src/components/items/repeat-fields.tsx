import { FormChoice, FormDurationInput, FormInput, FormSelect, FormToggleGroup } from "@/components/forms/form-fields";
import { offersPerDay, type PerDay, PER_DAY_OPTIONS, type Repeat, REPEAT_OPTIONS } from "@/lib/item-form";
import type { Item } from "@/lib/items";
import { type Weekday, WEEKDAYS } from "@/lib/recurrence";
import { WEEKDAY_NAMES } from "@/lib/time/format";

const REPEAT_LABELS = { none: "Doesn't repeat", daily: "Daily", weekly: "Weekly" } satisfies Record<Repeat, string>;

const WEEKDAY_OPTIONS = WEEKDAYS.map((day) => ({ value: String(day), label: WEEKDAY_NAMES[day - 1] }));

const PER_DAY_LABELS = { same: "Same each day", each: "Different each day" } satisfies Record<PerDay, string>;

/** What a weekly item can have per day: a fixed item its times, a task its duration. */
const PER_DAY_COPY = {
  fixed: {
    label: "Times",
    description: {
      same: "It starts and ends at the same time on each of its days.",
      each: "Each day gets its own start and end, under When.",
    },
  },
  flexible: {
    label: "Duration",
    description: {
      same: "It takes the same time on each of its days.",
      each: "Each day gets its own duration, under When.",
    },
  },
} satisfies Record<Item["timing"], { label: string; description: Record<PerDay, string> }>;

interface RepeatProps {
  timing: Item["timing"];
  repeat: Repeat;
  onRepeatChange: (repeat: Repeat) => void;
  weekdays: Weekday[];
  onWeekdaysChange: (weekdays: Weekday[]) => void;
  perDay: PerDay;
  onPerDayChange: (perDay: PerDay) => void;
}

/**
 * How often an item repeats, with the rule's own fields right under it once it does, and for a weekly item on more
 * than one day, whether each day has its own times or duration.
 */
export function RepeatFields({
  timing,
  repeat,
  onRepeatChange,
  weekdays,
  onWeekdaysChange,
  perDay,
  onPerDayChange,
}: RepeatProps) {
  const copy = PER_DAY_COPY[timing];
  return (
    <>
      <FormSelect
        name="repeat"
        label="How often"
        options={REPEAT_OPTIONS.map((value) => ({ value, label: REPEAT_LABELS[value] }))}
        defaultValue="none"
        onValueChange={(value) => onRepeatChange(value as Repeat)}
      />
      {/* These two are hidden rather than gone while they don't apply, so they keep what was picked for when they do. */}
      <div hidden={repeat !== "weekly"}>
        <FormToggleGroup
          name="weekdays"
          label="On"
          options={WEEKDAY_OPTIONS}
          onValueChange={(values) => onWeekdaysChange(values.map((value) => Number(value) as Weekday))}
        />
      </div>
      <div hidden={!offersPerDay(repeat, weekdays)}>
        <FormChoice
          name="perDay"
          label={copy.label}
          description={copy.description[perDay]}
          options={PER_DAY_OPTIONS.map((value) => ({ value, label: PER_DAY_LABELS[value] }))}
          defaultValue="same"
          onValueChange={onPerDayChange}
        />
      </div>
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
      {repeat !== "none" && timing === "flexible" && (
        <FormDurationInput
          name="totalMin"
          label="Stop after a total of"
          description="The series ends once its blocks add up to this much; missed ones don't count. Leave empty for no limit."
        />
      )}
    </>
  );
}
