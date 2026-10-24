"use client";

import { useState } from "react";
import {
  FormChoice,
  FormDateTimeInput,
  FormDurationInput,
  FormSection,
  useClearFormErrors,
  useFormErrors,
  useFormValue,
} from "@/components/forms/form-fields";
import { TimeRangeSlider } from "@/components/forms/time-range-slider";
import { useClockFormat } from "@/components/time/clock-format";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldError, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  type Amount,
  AMOUNT_OPTIONS,
  type Blocks,
  BLOCKS_OPTIONS,
  CATCH_UP_OPTIONS,
  type CatchUp,
  dayField,
  type Repeat,
  TIME_OF_DAY_RULES,
  type TimeOfDayRule,
} from "@/lib/item-form";
import { SPREAD_STRATEGIES, type SpreadStrategy } from "@/lib/items";
import type { Weekday } from "@/lib/recurrence";
import { DEFAULT_CHUNK_BREAK_MIN, DEFAULT_MAX_CHUNK_MIN, DEFAULT_MIN_CHUNK_MIN } from "@/lib/settings";
import { formatTimeOfDayRange } from "@/lib/time/clock";
import { formatDuration, WEEKDAY_NAMES } from "@/lib/time/format";
import { cn } from "@/lib/utils";

const SPREAD_LABELS = {
  asap: "Early",
  even: "Evenly",
  "just-in-time": "Near due",
} satisfies Record<SpreadStrategy, string>;

const DURATION_PRESETS = [30, 60, 90, 120];

const catchUpLabels = (period: string) =>
  ({ later: "Plan it later", "in-period": `Same ${period} only` }) satisfies Record<CatchUp, string>;

const AMOUNT_LABELS = { all: "Its full time", fits: "Only spare time" } satisfies Record<Amount, string>;

const periodOf = (repeat: Repeat) => (repeat === "daily" ? "day" : "week");

/**
 * A task's length: for a repeating one that gets only spare time, the most it gets each period. With `days`, each of
 * those weekdays has its own.
 */
export function DurationField({
  repeat = "none",
  upTo = false,
  days = null,
}: {
  repeat?: Repeat;
  upTo?: boolean;
  days?: Weekday[] | null;
}) {
  if (!days) {
    return (
      <FormDurationInput
        name="durationMin"
        label={upTo ? `At most per ${periodOf(repeat)}` : "Duration"}
        presets={DURATION_PRESETS}
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4">
      {days.map((day) => (
        <FormDurationInput
          key={day}
          name={dayField("durationMin", day)}
          label={`${upTo ? "At most on" : "On"} ${WEEKDAY_NAMES[day - 1]}`}
          presets={DURATION_PRESETS}
        />
      ))}
    </div>
  );
}

/**
 * Whether each occurrence of a repeating task must get its full time, or gets only the time other tasks leave. Comes
 * before the duration, which it relabels.
 */
export function AmountField({
  repeat,
  amount,
  onAmountChange,
}: {
  repeat: Repeat;
  amount: Amount;
  onAmountChange: (amount: Amount) => void;
}) {
  const period = periodOf(repeat);
  return (
    <FormChoice
      name="amount"
      label={`Each ${period} it gets`}
      description={
        amount === "fits"
          ? `Only time your other tasks leave, up to the most below. It never waits in the queue or moves other tasks, and time it doesn't get that ${period} is skipped.`
          : `Planned like any task. If its full time doesn't fit, it waits in the queue, and lower-priority tasks may move to make room.`
      }
      options={AMOUNT_OPTIONS.map((value) => ({ value, label: AMOUNT_LABELS[value] }))}
      defaultValue="all"
      onValueChange={onAmountChange}
    />
  );
}

/**
 * When a task can start and by when. A repeating task isn't asked for a due date: in its place, until when each
 * occurrence may be planned, unless it takes only what fits, which keeps it to its own period.
 */
export function TaskWindowFields({ repeat, upTo = false }: { repeat: Repeat; upTo?: boolean }) {
  const period = repeat === "daily" ? "day" : "week";
  return (
    <>
      <FormDateTimeInput
        name="earliestStart"
        clearable
        label="Not before"
        placeholder={repeat === "none" ? "Now" : "Not set"}
        description={repeat === "none" ? "Leave empty to start now." : "When the first one can start."}
      />
      {repeat === "none" ? (
        <FormDateTimeInput name="deadline" label="Due" placeholder="Not set" />
      ) : upTo ? null : (
        <FormChoice
          key={period}
          name="catchUp"
          label="If it doesn't happen"
          description={`Plan it later: any time before the next one. Same ${period} only: within its own ${period}, or its ${period}s when it repeats every few.`}
          options={CATCH_UP_OPTIONS.map((value) => ({ value, label: catchUpLabels(period)[value] }))}
          defaultValue="later"
        />
      )}
    </>
  );
}

const TIME_OF_DAY_PRESETS: { label: string; range: [number, number] }[] = [
  { label: "Morning", range: [8 * 60, 12 * 60] },
  { label: "Afternoon", range: [12 * 60, 17 * 60] },
  { label: "Evening", range: [18 * 60, 22 * 60] },
];

const TIME_OF_DAY_RULE_LABELS = { prefer: "If it fits", must: "Always" } satisfies Record<TimeOfDayRule, string>;

/** The hours of the day a task's blocks go in, picked from presets or on a slider, kept to always or if they fit. */
export function TimeOfDayField() {
  const [start, end] = [useFormValue("timeOfDayStart"), useFormValue("timeOfDayEnd")];
  const [range, setRange] = useState<[number, number] | null>(start && end ? [Number(start), Number(end)] : null);
  const messages = useFormErrors("timeOfDay");
  const clearErrors = useClearFormErrors("timeOfDay");
  const clock = useClockFormat();
  const pick = (next: [number, number] | null) => {
    clearErrors();
    setRange(next);
  };
  const isRange = (other: [number, number] | null) => other?.[0] === range?.[0] && other?.[1] === range?.[1];

  return (
    <FieldSet data-invalid={messages ? true : undefined} className="gap-2">
      <FieldLegend variant="label">Time of day</FieldLegend>
      <input type="hidden" name="timeOfDayStart" value={range?.[0] ?? ""} />
      <input type="hidden" name="timeOfDayEnd" value={range?.[1] ?? ""} />
      <div className="flex flex-wrap gap-1">
        {[{ label: "Any time", range: null }, ...TIME_OF_DAY_PRESETS].map((preset) => (
          <Button
            key={preset.label}
            type="button"
            size="sm"
            variant={isRange(preset.range) ? "default" : "outline"}
            aria-pressed={isRange(preset.range)}
            onClick={() => pick(preset.range)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      {range && (
        <>
          <div className="flex items-center gap-3">
            <TimeRangeSlider value={range} onValueChange={pick} />
            <span className={cn("shrink-0 text-right text-sm tabular-nums", clock === "24h" ? "w-24" : "w-36")}>
              {formatTimeOfDayRange(range[0], range[1], clock)}
            </span>
          </div>
          <FormChoice
            name="timeOfDayRule"
            label="Keep to it"
            description="Always: never planned outside these hours. If it fits: outside them only when they're full."
            options={TIME_OF_DAY_RULES.map((value) => ({ value, label: TIME_OF_DAY_RULE_LABELS[value] }))}
            defaultValue="prefer"
          />
        </>
      )}
      {!range && <FieldDescription>Planned at any time of day.</FieldDescription>}
      <FieldError errors={messages?.map((message) => ({ message }))} />
    </FieldSet>
  );
}

const BLOCKS_LABELS = { one: "One block", split: "Split it up" } satisfies Record<Blocks, string>;

export function TaskScheduleSection() {
  const [split, setSplit] = useState(useFormValue("blocks") === "split");

  return (
    <FormSection title="How to schedule">
      <FormChoice
        name="blocks"
        label="Blocks"
        options={BLOCKS_OPTIONS.map((value) => ({ value, label: BLOCKS_LABELS[value] }))}
        defaultValue="one"
        onValueChange={(value) => setSplit(value === "split")}
      />
      {split && (
        <div className="grid grid-cols-2 gap-4">
          <FormDurationInput
            name="minChunkMin"
            label="Shortest block"
            description={`Leave empty for ${formatDuration(DEFAULT_MIN_CHUNK_MIN)}.`}
          />
          <FormDurationInput
            name="maxChunkMin"
            label="Longest block"
            description={`Leave empty for ${formatDuration(DEFAULT_MAX_CHUNK_MIN)}.`}
          />
          <FormDurationInput
            name="breakMin"
            label="At least between blocks"
            description={`The least time between two of its blocks. Leave empty for ${formatDuration(DEFAULT_CHUNK_BREAK_MIN)}.`}
          />
        </div>
      )}
      <FormChoice
        name="spread"
        label="Work on it"
        description="Where its blocks go between its start and when it's due."
        options={SPREAD_STRATEGIES.map((value) => ({ value, label: SPREAD_LABELS[value] }))}
        defaultValue="asap"
      />
    </FormSection>
  );
}
