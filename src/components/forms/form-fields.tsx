"use client";

import { X } from "lucide-react";
import { createContext, use, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { type Segment, SegmentedControl } from "@/components/controls/segmented-control";
import { useClockFormat } from "@/components/time/clock-format";
import { SLOT_MIN } from "@/lib/placements";
import { type ClockFormat, fromReading, type Period, toReading } from "@/lib/time/clock";
import { formatDuration } from "@/lib/time/format";
import { fromTimeInputValue, MINUTES_PER_DAY, toTimeInputValue } from "@/lib/time/time-of-day";

interface FieldValues {
  /** Submitted values, used as defaults so a failed submission doesn't clear the form. */
  values: Partial<Record<string, string>>;
  errors: Partial<Record<string, string[]>>;
}

interface FormState extends FieldValues {
  /** Hides `name`'s errors once it changes, until the next submission. */
  clearErrors: (name: string) => void;
}

const FormStateContext = createContext<FormState>({ values: {}, errors: {}, clearErrors: () => {} });

export function useFormValue(name: string): string | undefined {
  return use(FormStateContext).values[name];
}

export function useFormErrors(name: string): string[] | undefined {
  return use(FormStateContext).errors[name];
}

/** Call when the field `name` changes, so the errors of its last submission stop showing. */
export function useClearFormErrors(name: string): () => void {
  const { clearErrors } = use(FormStateContext);
  return () => clearErrors(name);
}

export function FormStateProvider({ children, values, errors }: FieldValues & { children: React.ReactNode }) {
  const [edited, setEdited] = useState({ errors, names: new Set<string>() });
  if (edited.errors !== errors) setEdited({ errors, names: new Set() });
  const shown = Object.fromEntries(Object.entries(errors).filter(([name]) => !edited.names.has(name)));
  const clearErrors = (name: string) => {
    if (errors[name] && !edited.names.has(name)) setEdited({ errors, names: new Set(edited.names).add(name) });
  };
  return <FormStateContext value={{ values, errors: shown, clearErrors }}>{children}</FormStateContext>;
}

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <FieldSet>
      <FieldLegend
        variant="label"
        className="flex w-full items-center gap-3 text-xs tracking-wide text-muted-foreground uppercase after:h-px after:flex-1 after:bg-border"
      >
        {title}
      </FieldLegend>
      {children}
    </FieldSet>
  );
}

interface FieldProps {
  name: string;
  label: string;
  description?: string;
}

function FormField({ name, label, description, children }: FieldProps & { children: React.ReactNode }) {
  const messages = use(FormStateContext).errors[name];
  return (
    <Field data-invalid={messages ? true : undefined}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      {children}
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={messages?.map((message) => ({ message }))} />
    </Field>
  );
}

const PICKER_TYPES = ["date", "time", "datetime-local"];

/**
 * `clearable` adds a button that empties the input: WebKit offers no way to empty a date or time input. An empty
 * date or time input shows its `placeholder`, which browsers otherwise ignore there; WebKit shows today instead.
 */
export function FormInput({
  name,
  label,
  description,
  clearable = false,
  className,
  onInput,
  ...props
}: FieldProps & { clearable?: boolean } & React.ComponentProps<"input">) {
  const { values, errors, clearErrors } = use(FormStateContext);
  // The input keeps what was typed after a failed submission; changing its default then would only warn.
  const [initialValue] = useState(values[name]);
  const [empty, setEmpty] = useState(!initialValue);
  const ref = useRef<HTMLInputElement>(null);
  const hint = empty && PICKER_TYPES.includes(props.type ?? "") ? props.placeholder : undefined;
  const input = (
    <div className={cn("relative min-w-0", clearable && "flex-1")}>
      <Input
        ref={ref}
        id={name}
        name={name}
        defaultValue={initialValue}
        aria-invalid={errors[name] ? true : undefined}
        // Styled date and time inputs in WebKit show the current time when empty, in full colour unless muted here.
        data-empty={empty ? true : undefined}
        onInput={(event) => {
          setEmpty(!event.currentTarget.value);
          clearErrors(name);
          onInput?.(event);
        }}
        className={cn("peer", hint ? "not-focus:text-transparent" : "data-empty:text-muted-foreground", className)}
        {...props}
      />
      {hint && (
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground peer-focus:hidden">
          {hint}
        </span>
      )}
    </div>
  );

  return (
    <FormField name={name} label={label} description={description}>
      {clearable ? (
        <div className="flex gap-1">
          {input}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Clear ${label}`}
            disabled={empty}
            onClick={() => {
              ref.current!.value = "";
              setEmpty(true);
              clearErrors(name);
            }}
          >
            <X />
          </Button>
        </div>
      ) : (
        input
      )}
    </FormField>
  );
}

/** Hours and minutes as typed into two boxes, digits only, and the period of a time on a 12-hour clock. */
interface Clock {
  hours: string;
  minutes: string;
  period?: Period;
}

const NO_CLOCK: Clock = { hours: "", minutes: "" };

/** How boxes holding a number of minutes read and write it; `toMinutes` is `null` when they hold none. */
interface ClockConversion {
  toClock: (minutes: number) => Clock;
  toMinutes: (clock: Clock) => number | null;
}

/** A duration: any number of hours, each box written without padding and a missing one counting as 0. */
const DURATION: ClockConversion = {
  toClock: (minutes) => ({ hours: String(Math.floor(minutes / 60)), minutes: String(minutes % 60) }),
  toMinutes: ({ hours, minutes }) =>
    hours === "" && minutes === "" ? null : Number(hours || 0) * 60 + Number(minutes || 0),
};

/** The minute of the day `clock` reads, a missing box counting as midnight's hour or 0 minutes. */
function minuteOfDayOf({ hours, minutes, period }: Clock): number | null {
  if (hours === "" && minutes === "") return null;
  return fromReading({
    hours: hours === "" ? (period ? 12 : 0) : Number(hours),
    minutes: Number(minutes || 0),
    period,
  });
}

/** A time of day on `format`'s clock: 24-hour hours padded to two digits, 12-hour ones not. */
function timeOfDay(format: ClockFormat): ClockConversion {
  return {
    toClock: (minuteOfDay) => {
      const { hours, minutes, period } = toReading(minuteOfDay, format);
      const pad = (part: number) => String(part).padStart(2, "0");
      return { hours: period ? String(hours) : pad(hours), minutes: pad(minutes), period };
    },
    toMinutes: minuteOfDayOf,
  };
}

/** An empty time on `format`'s clock; one on a 12-hour clock starts in the morning. */
const noTime = (format: ClockFormat): Clock => (format === "12h" ? { ...NO_CLOCK, period: "AM" } : NO_CLOCK);

const PERIODS: readonly Segment<Period>[] = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

/**
 * Two boxes for hours and minutes, labelled `label` hours and minutes, that take only digits, and an AM/PM choice when
 * `clock` has a period. The arrow keys step the hours by one and the minutes by `SLOT_MIN`, carrying over, between 0
 * and `maxMinutes`.
 */
function ClockBoxes({
  id,
  label,
  clock,
  onChange,
  conversion,
  maxMinutes,
  separator,
  invalid,
  placeholder = NO_CLOCK,
}: {
  id: string;
  label: string;
  clock: Clock;
  onChange: (clock: Clock) => void;
  conversion: ClockConversion;
  maxMinutes: number;
  /** Shown between the boxes, like ":" for a time; otherwise each box is followed by "h" or "m". */
  separator?: string;
  invalid: boolean;
  placeholder?: Pick<Clock, "hours" | "minutes">;
}) {
  const step = (by: number) => (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const total = (conversion.toMinutes(clock) ?? 0) + (event.key === "ArrowUp" ? by : -by);
    onChange(conversion.toClock(Math.min(Math.max(total, 0), maxMinutes)));
  };
  // Leaving the boxes writes the time out in full, such as 90 minutes as 1h 30m.
  const tidy = () => {
    const minutes = conversion.toMinutes(clock);
    if (minutes !== null && minutes <= maxMinutes) onChange(conversion.toClock(minutes));
  };
  const box = (part: "hours" | "minutes", by: number) => (
    <Input
      id={part === "hours" ? id : undefined}
      aria-label={`${label} ${part}`}
      inputMode="numeric"
      autoComplete="off"
      value={clock[part]}
      placeholder={placeholder[part]}
      aria-invalid={invalid || undefined}
      onChange={(event) => onChange({ ...clock, [part]: event.target.value.replace(/\D/g, "").slice(0, 3) })}
      onKeyDown={step(by)}
      onFocus={(event) => event.currentTarget.select()}
      className="w-14 text-right tabular-nums"
    />
  );

  return (
    <div
      className="flex items-center gap-1.5 text-sm text-muted-foreground"
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && tidy()}
    >
      {box("hours", 60)}
      <span aria-hidden>{separator ?? "h"}</span>
      {box("minutes", SLOT_MIN)}
      {!separator && <span aria-hidden>m</span>}
      {clock.period && (
        <SegmentedControl
          label={`${label} AM or PM`}
          options={PERIODS}
          value={clock.period}
          onChange={(period) => onChange({ ...clock, period })}
          className="flex gap-0 p-px"
        />
      )}
    </div>
  );
}

/** A duration in hours and minutes, submitted in minutes. `presets` are minutes offered as buttons. */
export function FormDurationInput({ name, label, description, presets = [] }: FieldProps & { presets?: number[] }) {
  const { values, errors, clearErrors } = use(FormStateContext);
  const [clock, setClock] = useState(() =>
    /^\d+$/.test(values[name] ?? "") ? DURATION.toClock(Number(values[name])) : NO_CLOCK,
  );
  const minutes = DURATION.toMinutes(clock);
  const change = (next: Clock) => {
    clearErrors(name);
    setClock(next);
  };

  return (
    <FormField name={name} label={label} description={description}>
      <ClockBoxes
        id={name}
        label={label}
        clock={clock}
        onChange={change}
        conversion={DURATION}
        maxMinutes={Infinity}
        invalid={!!errors[name]}
      />
      <input type="hidden" name={name} value={minutes ?? ""} />
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => change(DURATION.toClock(preset))}
            >
              {formatDuration(preset)}
            </Button>
          ))}
        </div>
      )}
    </FormField>
  );
}

const isTimeValue = (value: string) => /^\d{2}:\d{2}$/.test(value);

/**
 * The 24-hour "HH:mm" the server takes for `clock`, whatever clock it was typed on, or what was typed when no clock
 * reads it, for the server to reject.
 */
function timeValue(clock: Clock): string {
  if (clock.hours === "" && clock.minutes === "") return "";
  const minuteOfDay = minuteOfDayOf(clock);
  if (minuteOfDay !== null) return toTimeInputValue(minuteOfDay);
  return `${clock.hours}:${clock.minutes}${clock.period ? ` ${clock.period}` : ""}`;
}

/** `value`, a 24-hour "HH:mm" or empty, as typed on `format`'s clock. */
const clockOfTime = (value: string, format: ClockFormat): Clock =>
  isTimeValue(value) ? timeOfDay(format).toClock(fromTimeInputValue(value)) : noTime(format);

/** Hours and minutes of a time of day, on the account's clock. */
function TimeBoxes(
  props: Pick<React.ComponentProps<typeof ClockBoxes>, "id" | "label" | "clock" | "onChange" | "invalid">,
) {
  const format = useClockFormat();
  return (
    <ClockBoxes
      {...props}
      conversion={timeOfDay(format)}
      maxMinutes={MINUTES_PER_DAY - SLOT_MIN}
      separator=":"
      placeholder={{ hours: "--", minutes: "--" }}
    />
  );
}

/** A time of day in hours and minutes, submitted as "HH:mm"; `value` and `onChange` let the form link it to others. */
export function FormTimeInput({
  name,
  label,
  description,
  value,
  onChange,
}: FieldProps & { value: string; onChange: (value: string) => void }) {
  const { errors, clearErrors } = use(FormStateContext);
  const format = useClockFormat();
  const [clock, setClock] = useState(() => clockOfTime(value, format));
  // Follows a `value` set from outside, such as an end moved with its start.
  if (isTimeValue(value) && value !== timeValue(clock)) setClock(clockOfTime(value, format));

  return (
    <FormField name={name} label={label} description={description}>
      <TimeBoxes
        id={name}
        label={label}
        clock={clock}
        onChange={(next) => {
          clearErrors(name);
          setClock(next);
          onChange(timeValue(next));
        }}
        invalid={!!errors[name]}
      />
      <input type="hidden" name={name} value={timeValue(clock)} />
    </FormField>
  );
}

/**
 * A date and a time, submitted together as "YYYY-MM-DDTHH:mm": the date in the browser's own date picker, the time
 * in hours and minutes. `clearable` adds a button that empties both.
 */
export function FormDateTimeInput({
  name,
  label,
  description,
  placeholder,
  clearable = false,
}: FieldProps & { placeholder?: string; clearable?: boolean }) {
  const { values, errors, clearErrors } = use(FormStateContext);
  const format = useClockFormat();
  const [initial] = useState(values[name] ?? "");
  const [date, setDate] = useState(initial.slice(0, 10));
  const [clock, setClock] = useState(() => clockOfTime(initial.slice(11, 16), format));
  const time = timeValue(clock);
  const empty = !date && !time;
  const invalid = !!errors[name];

  return (
    <FormField name={name} label={label} description={description}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-36">
          <Input
            id={name}
            type="date"
            aria-label={`${label} date`}
            value={date}
            aria-invalid={invalid || undefined}
            onChange={(event) => {
              clearErrors(name);
              setDate(event.target.value);
            }}
            // WebKit shows today in an empty date input: hidden behind the placeholder, or at least muted.
            className={cn("peer", !date && (placeholder ? "not-focus:text-transparent" : "text-muted-foreground"))}
          />
          {!date && placeholder && (
            <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground peer-focus:hidden">
              {placeholder}
            </span>
          )}
        </div>
        <TimeBoxes
          id={`${name}-time`}
          label={label}
          clock={clock}
          onChange={(next) => {
            clearErrors(name);
            setClock(next);
          }}
          invalid={invalid}
        />
        {clearable && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Clear ${label}`}
            disabled={empty}
            onClick={() => {
              clearErrors(name);
              setDate("");
              setClock(noTime(format));
            }}
          >
            <X />
          </Button>
        )}
      </div>
      <input type="hidden" name={name} value={empty ? "" : `${date}T${time}`} />
    </FormField>
  );
}

/** One of a few `options` as a row of buttons, submitted as `name` when given. */
export function FormChoice<T extends string>({
  name,
  label,
  description,
  options,
  defaultValue,
  onValueChange,
}: {
  name?: string;
  label: string;
  description?: string;
  options: readonly Segment<T>[];
  defaultValue: T;
  onValueChange?: (value: T) => void;
}) {
  const submitted = use(FormStateContext).values[name ?? ""];
  const [value, setValue] = useState(options.find((option) => option.value === submitted)?.value ?? defaultValue);

  return (
    <FieldSet className="gap-2">
      <FieldLegend variant="label">{label}</FieldLegend>
      {name && <input type="hidden" name={name} value={value} />}
      <SegmentedControl
        label={label}
        options={options}
        value={value}
        onChange={(next) => {
          setValue(next);
          onValueChange?.(next);
        }}
        className="grid"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
    </FieldSet>
  );
}

export function FormSelect({
  name,
  label,
  options,
  defaultValue,
  onValueChange,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  defaultValue: string;
  onValueChange?: (value: string) => void;
}) {
  const { values, clearErrors } = use(FormStateContext);
  return (
    <FormField name={name} label={label}>
      <NativeSelect
        id={name}
        name={name}
        defaultValue={values[name] ?? defaultValue}
        onChange={(event) => {
          clearErrors(name);
          onValueChange?.(event.target.value);
        }}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </FormField>
  );
}

/** Picks any of `options`, submitted comma-separated. */
export function FormToggleGroup({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
}) {
  const { values, errors, clearErrors } = use(FormStateContext);
  const [picked, setPicked] = useState(() => new Set(values[name]?.split(",").filter(Boolean)));
  const messages = errors[name];
  const toggle = (value: string) => {
    clearErrors(name);
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(value)) next.add(value);
      return next;
    });
  };

  return (
    <FieldSet data-invalid={messages ? true : undefined} className="gap-0">
      <FieldLegend variant="label">{label}</FieldLegend>
      <input
        type="hidden"
        name={name}
        value={options
          .filter((option) => picked.has(option.value))
          .map((option) => option.value)
          .join(",")}
      />
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={picked.has(option.value) ? "default" : "outline"}
            aria-pressed={picked.has(option.value)}
            onClick={() => toggle(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <FieldError className="mt-2" errors={messages?.map((message) => ({ message }))} />
    </FieldSet>
  );
}
