import { z } from "zod";
import type { FormErrors } from "@/lib/form-state";
import {
  AMOUNT_OPTIONS,
  BLOCKS_OPTIONS,
  CATCH_UP_OPTIONS,
  dayField,
  offersPerDay,
  PER_DAY_OPTIONS,
  REPEAT_OPTIONS,
  TIME_OF_DAY_RULES,
} from "@/lib/item-form";
import {
  type DayTime,
  isFixed,
  type Item,
  type NewItem,
  type NewTask,
  PRIORITIES,
  SPREAD_STRATEGIES,
  type TimeOfDay,
} from "@/lib/items";
import { SLOT_MIN } from "@/lib/placements";
import { DEFAULT_CHUNK_BREAK_MIN, DEFAULT_MAX_CHUNK_MIN, DEFAULT_MIN_CHUNK_MIN } from "@/lib/settings";
import { type ByWeekday, type OccurrenceChange, type Recurrence, type Weekday, WEEKDAYS } from "@/lib/recurrence";
import { minutesBetween } from "@/lib/time/duration";
import { fromTimeInputValue, MINUTES_PER_DAY } from "@/lib/time/time-of-day";
import type { TimeZone } from "@/lib/time/time-zone";
import { firstOccurrence, withFirstDeadline } from "@/server/recurrence";
import { atLocalTime, toDate } from "@/server/time/temporal";
import { hoursOf } from "@/server/scheduler/preferences";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);
const toNumber = (value: unknown) => {
  const present = emptyToUndefined(value);
  return typeof present === "string" ? Number(present) : present;
};

/** Local wall-clock time as sent by `<input type="datetime-local">`, e.g. "2026-10-01T14:00". */
const localDateTime = z.iso.datetime({ local: true, error: "Enter a date and time" });
const localTime = z.iso.time({ precision: -1, error: "Enter a time" });
const DURATION_ERROR = "Enter a duration";
const dayMinute = z
  .number({ error: "Choose hours" })
  .int()
  .min(0)
  .max(MINUTES_PER_DAY)
  .multipleOf(SLOT_MIN, `Use multiples of ${SLOT_MIN} minutes`);
const minutes = (min: number) => z.number({ error: DURATION_ERROR }).int().min(min);
const taskMinutes = z
  .number({ error: DURATION_ERROR })
  .min(SLOT_MIN)
  .multipleOf(SLOT_MIN, `Use multiples of ${SLOT_MIN} minutes`);

/** Comma-separated ISO weekday numbers, e.g. "1,3,5", as kept by the weekday toggles; sorted and deduplicated. */
const weekdayList = z
  .string()
  .transform((value) => [...new Set(value.split(",").filter(Boolean).map(Number))].sort((a, b) => a - b))
  .pipe(z.array(z.literal(WEEKDAYS)));

const shared = {
  title: z.string().trim().min(1, "Enter a title").max(200),
  priority: z.preprocess(emptyToUndefined, z.enum(PRIORITIES).default("normal")),
  repeat: z.preprocess(emptyToUndefined, z.enum(REPEAT_OPTIONS).default("none")),
  interval: z.preprocess(toNumber, z.number({ error: "Enter a whole number" }).int().min(1).max(99).default(1)),
  weekdays: z.preprocess((value) => value ?? "", weekdayList),
  until: z.preprocess(emptyToUndefined, z.iso.date({ error: "Enter a date" }).optional()),
  perDay: z.preprocess(emptyToUndefined, z.enum(PER_DAY_OPTIONS).default("same")),
  category: z.preprocess(emptyToUndefined, z.uuid("Pick a category").optional()),
};

// Zod skips refinements while any field is invalid. These only test whether a field is present, which works on
// unparsed values too, so they run anyway and their errors show together with the rest.
const evenIfInvalid = { when: () => true };

const weekdaysChosen = {
  check: (form: { repeat: string; weekdays: number[] }) => form.repeat !== "weekly" || form.weekdays.length > 0,
  params: { path: ["weekdays"], message: "Choose at least one day", ...evenIfInvalid },
};

const fixedForm = z
  .object({
    ...shared,
    timing: z.literal("fixed"),
    date: z.iso.date({ error: "Enter a date" }),
    location: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
    bufferBeforeMin: z.preprocess(toNumber, minutes(0).default(0)),
    bufferAfterMin: z.preprocess(toNumber, minutes(0).default(0)),
  })
  .refine(weekdaysChosen.check, weekdaysChosen.params);

const flexibleForm = z
  .object({
    ...shared,
    timing: z.literal("flexible"),
    earliestStart: z.preprocess(emptyToUndefined, localDateTime.optional()),
    deadline: z.preprocess(emptyToUndefined, localDateTime.optional()),
    blocks: z.preprocess(emptyToUndefined, z.enum(BLOCKS_OPTIONS).default("one")),
    minChunkMin: z.preprocess(toNumber, taskMinutes.optional()),
    maxChunkMin: z.preprocess(toNumber, taskMinutes.optional()),
    breakMin: z.preprocess(
      toNumber,
      minutes(0).multipleOf(SLOT_MIN, `Use multiples of ${SLOT_MIN} minutes`).optional(),
    ),
    spread: z.preprocess(emptyToUndefined, z.enum(SPREAD_STRATEGIES).default("asap")),
    amount: z.preprocess(emptyToUndefined, z.enum(AMOUNT_OPTIONS).default("all")),
    catchUp: z.preprocess(emptyToUndefined, z.enum(CATCH_UP_OPTIONS).default("later")),
    totalMin: z.preprocess(toNumber, taskMinutes.optional()),
    timeOfDayStart: z.preprocess(toNumber, dayMinute.optional()),
    timeOfDayEnd: z.preprocess(toNumber, dayMinute.optional()),
    timeOfDayRule: z.preprocess(emptyToUndefined, z.enum(TIME_OF_DAY_RULES).default("prefer")),
  })
  .refine(weekdaysChosen.check, weekdaysChosen.params)
  .refine((form) => form.repeat !== "none" || form.deadline !== undefined, {
    path: ["deadline"],
    message: "Enter a date and time",
    ...evenIfInvalid,
  })
  .refine((form) => form.repeat === "none" || form.earliestStart !== undefined, {
    path: ["earliestStart"],
    message: "Enter when each occurrence can start",
    ...evenIfInvalid,
  })
  .refine((form) => (form.minChunkMin ?? DEFAULT_MIN_CHUNK_MIN) <= (form.maxChunkMin ?? DEFAULT_MAX_CHUNK_MIN), {
    path: ["maxChunkMin"],
    message: "Longest block must be at least the shortest",
  })
  .refine(
    ({ timeOfDayStart: start, timeOfDayEnd: end }) =>
      (start === undefined && end === undefined) || (start !== undefined && end !== undefined && start < end),
    { path: ["timeOfDay"], message: "Choose hours that end after they start" },
  );

const itemFormSchema = z.discriminatedUnion("timing", [fixedForm, flexibleForm]);

const dayTimeForm = z
  .object({ startTime: localTime, endTime: localTime })
  .refine((form) => form.startTime !== form.endTime, { path: ["endTime"], message: "End must differ from start" })
  .transform((form): DayTime => ({
    startMinute: fromTimeInputValue(form.startTime),
    endMinute: fromTimeInputValue(form.endTime),
  }));

const durationForm = z
  .object({ durationMin: z.preprocess(toNumber, taskMinutes) })
  .transform((form) => form.durationMin);

type Parsed<T> = { ok: true; value: T } | { ok: false; errors: FormErrors };

/** A fixed item's times or a task's duration as parsed: `byDay` when each day has its own, `value` the first day's. */
type Timing<T> = { ok: true; value: T; byDay: ByWeekday<T> | null };

/**
 * A fixed item's times or a task's duration: from their own fields, or with `days`, each day's from its own (see
 * `dayField`), with errors under those fields' names.
 */
function parseTiming<T>(
  schema: z.ZodType<T>,
  names: string[],
  fields: Record<string, unknown>,
  days: Weekday[] | null,
): Timing<T> | { ok: false; errors: FormErrors } {
  if (!days) {
    const parsed = parsePart(schema, fields);
    return parsed.ok ? { ...parsed, byDay: null } : parsed;
  }
  const byDay: ByWeekday<T> = {};
  let errors: FormErrors = {};
  for (const day of days) {
    const parsed = parsePart(schema, Object.fromEntries(names.map((name) => [name, fields[dayField(name, day)]])));
    if (parsed.ok) byDay[day] = parsed.value;
    else {
      const renamed = Object.entries(parsed.errors).map(([name, messages]) => [dayField(name, day), messages]);
      errors = { ...errors, ...Object.fromEntries(renamed) };
    }
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: byDay[days[0]]!, byDay };
}

function parsePart<T>(schema: z.ZodType<T>, fields: Record<string, unknown>): Parsed<T> {
  const parsed = schema.safeParse(fields);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, errors: z.flattenError(parsed.error).fieldErrors };
}

/** A per-day value on the first date's weekday, or the first day's if the series' first date isn't one of its days. */
const onFirstDate = <T>(date: Temporal.PlainDate, { value, byDay }: { value: T; byDay: ByWeekday<T> | null }) =>
  byDay?.[date.dayOfWeek as Weekday] ?? value;

/** The days of a submitted weekly rule that have their own times or duration, or `null`; read even if it's invalid. */
function perDayOf(fields: Record<string, unknown>): Weekday[] | null {
  const parsed = z
    .object({ repeat: shared.repeat, weekdays: shared.weekdays, perDay: shared.perDay })
    .safeParse(fields);
  if (!parsed.success) return null;
  const { repeat, weekdays, perDay } = parsed.data;
  return offersPerDay(repeat, weekdays) && perDay === "each" ? weekdays : null;
}

export type ParsedItemForm = { ok: true; item: NewItem } | { ok: false; errors: FormErrors };

/**
 * Validates submitted form fields and converts their local times to exact times in `timeZone`. A fixed item ending at
 * an earlier time than it starts ends the next day.
 * A one-off flexible task without an earliest start starts at `now`, and its deadline must be after `now`.
 * A recurring item must occur at least once; a recurring task is due when its first occurrence's window ends. Only a
 * recurring task can be kept within its period, take only what fits, or stop after a total. A task that must be placed in its time of day has to fit there: each
 * of its blocks within the hours, and a one-off one in those hours before it's due. A weekly item on more than one day
 * may have its own times, or a task its own duration, for each day; its own are then its first date's.
 */
export function parseItemForm(fields: Record<string, unknown>, timeZone: TimeZone, now: Date): ParsedItemForm {
  const parsed = itemFormSchema.safeParse(fields);
  const days = perDayOf(fields);
  const timing =
    fields.timing === "fixed"
      ? parseTiming(dayTimeForm, ["startTime", "endTime"], fields, days)
      : parseTiming(durationForm, ["durationMin"], fields, days);
  if (!parsed.success || !timing.ok) {
    return {
      ok: false,
      errors: {
        ...(parsed.success ? {} : z.flattenError(parsed.error).fieldErrors),
        ...(timing.ok ? {} : timing.errors),
      },
    };
  }

  const form = parsed.data;
  const at = (local: string) => toDate(Temporal.PlainDateTime.from(local).toZonedDateTime(timeZone));
  const until = form.until ?? null;
  const recurrence: Recurrence | null =
    form.repeat === "none"
      ? null
      : form.repeat === "daily"
        ? { frequency: "daily", interval: form.interval, until }
        : { frequency: "weekly", interval: form.interval, weekdays: form.weekdays, until };
  const neverOccurs: ParsedItemForm = { ok: false, errors: { until: ["The series ends before it first occurs"] } };

  if (form.timing === "fixed") {
    const fixedTiming = timing as Timing<DayTime>;
    const date = Temporal.PlainDate.from(form.date);
    const time = onFirstDate(date, fixedTiming);
    const item: NewItem = {
      title: form.title,
      priority: form.priority,
      timing: "fixed",
      recurrence,
      categoryId: form.category ?? null,
      start: atLocalTime(date, time.startMinute, timeZone),
      end: atLocalTime(time.endMinute > time.startMinute ? date : date.add({ days: 1 }), time.endMinute, timeZone),
      dayTimes: fixedTiming.byDay,
      location: form.location ?? null,
      bufferBeforeMin: form.bufferBeforeMin,
      bufferAfterMin: form.bufferAfterMin,
    };
    return recurrence && !firstOccurrence(item, timeZone) ? neverOccurs : { ok: true, item };
  }
  const taskTiming = timing as Timing<number>;

  const timeOfDay: TimeOfDay | null =
    form.timeOfDayStart === undefined || form.timeOfDayEnd === undefined
      ? null
      : { startMinute: form.timeOfDayStart, endMinute: form.timeOfDayEnd, must: form.timeOfDayRule === "must" };
  const task = {
    title: form.title,
    priority: form.priority,
    timing: "flexible" as const,
    recurrence,
    categoryId: form.category ?? null,
    durationMin: form.earliestStart
      ? onFirstDate(Temporal.PlainDate.from(form.earliestStart.slice(0, 10)), taskTiming)
      : taskTiming.value,
    dayDurations: taskTiming.byDay,
    split:
      form.blocks === "split"
        ? {
            minChunkMin: form.minChunkMin ?? DEFAULT_MIN_CHUNK_MIN,
            maxChunkMin: form.maxChunkMin ?? DEFAULT_MAX_CHUNK_MIN,
            breakMin: form.breakMin ?? DEFAULT_CHUNK_BREAK_MIN,
          }
        : null,
    spread: form.spread,
    // Taking what fits keeps it within its period: what it doesn't get there is let go.
    withinPeriod: recurrence !== null && (form.catchUp === "in-period" || form.amount === "fits"),
    upTo: recurrence !== null && form.amount === "fits",
    totalMin: recurrence ? (form.totalMin ?? null) : null,
    timeOfDay,
  };
  const blockMinOf = (durationMin: number) => Math.min(task.split?.minChunkMin ?? durationMin, durationMin);
  const blockMin = blockMinOf(task.durationMin);
  const longestBlockMin = Math.max(...Object.values(task.dayDurations ?? {}).map(blockMinOf), blockMin);
  if (timeOfDay?.must && longestBlockMin > timeOfDay.endMinute - timeOfDay.startMinute) {
    return { ok: false, errors: { timeOfDay: ["Its blocks are longer than these hours"] } };
  }
  const earliestStart = form.earliestStart ? at(form.earliestStart) : now;

  if (recurrence) {
    const item = withFirstDeadline({ ...task, earliestStart }, timeZone);
    return item ? { ok: true, item } : neverOccurs;
  }

  const deadline = at(form.deadline!);
  if (deadline <= now) {
    return { ok: false, errors: { deadline: ["Deadline must be in the future"] } };
  }
  if (deadline <= earliestStart) {
    return { ok: false, errors: { deadline: ["Deadline must be after the earliest start"] } };
  }
  const item: NewTask = { ...task, earliestStart, deadline };
  if (timeOfDay?.must && !fitsInHours(item, blockMin, timeZone)) {
    return { ok: false, errors: { timeOfDay: ["It can't fit in these hours before it's due"] } };
  }
  return { ok: true, item };
}

/** Whether `task`'s time of day before it's due holds stretches of at least `blockMin` with all its time. */
function fitsInHours(task: NewTask, blockMin: number, timeZone: TimeZone): boolean {
  const usable = hoursOf(task, timeZone)
    .map((stretch) => minutesBetween(stretch.start, stretch.end))
    .filter((minutes) => minutes >= blockMin);
  return usable.reduce((sum, minutes) => sum + minutes, 0) >= task.durationMin;
}

const fixedOccurrenceForm = z
  .object({ date: z.iso.date({ error: "Enter a date" }), startTime: localTime, endTime: localTime })
  .refine((form) => form.startTime !== form.endTime, { path: ["endTime"], message: "End must differ from start" });

const taskOccurrenceForm = z
  .object({
    durationMin: z.preprocess(toNumber, taskMinutes),
    earliestStart: localDateTime,
    deadline: localDateTime,
  })
  .refine((form) => form.deadline > form.earliestStart, {
    path: ["deadline"],
    message: "Deadline must be after the earliest start",
  });

export type ParsedOccurrenceForm = { ok: true; change: OccurrenceChange } | { ok: false; errors: FormErrors };

/**
 * Validates one occurrence's own timing for an occurrence of `series`: a fixed one's date and times, which end the
 * next day if earlier than the start; a task one's duration and window, which must fit its time of day if it must
 * keep to it.
 */
export function parseOccurrenceForm(
  fields: Record<string, unknown>,
  series: Item,
  timeZone: TimeZone,
): ParsedOccurrenceForm {
  const at = (local: string) => toDate(Temporal.PlainDateTime.from(local).toZonedDateTime(timeZone));
  if (isFixed(series)) {
    const parsed = fixedOccurrenceForm.safeParse(fields);
    if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors };
    const { date, startTime, endTime } = parsed.data;
    const endDate = endTime < startTime ? Temporal.PlainDate.from(date).add({ days: 1 }) : date;
    return {
      ok: true,
      change: { start: at(`${date}T${startTime}`), end: at(`${endDate}T${endTime}`), durationMin: null },
    };
  }

  const parsed = taskOccurrenceForm.safeParse(fields);
  if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors };
  const { durationMin, earliestStart, deadline } = parsed.data;
  const occurrence = { ...series, durationMin, earliestStart: at(earliestStart), deadline: at(deadline) };
  const blockMin = Math.min(series.split?.minChunkMin ?? durationMin, durationMin);
  if (series.timeOfDay?.must && !fitsInHours(occurrence, blockMin, timeZone)) {
    return { ok: false, errors: { deadline: ["It can't fit in its hours of the day before it's due"] } };
  }
  return { ok: true, change: { start: occurrence.earliestStart, end: occurrence.deadline, durationMin } };
}
