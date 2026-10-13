import { z } from "zod";
import type { FormErrors } from "@/lib/form-state";
import { CATCH_UP_OPTIONS, REPEAT_OPTIONS } from "@/lib/item-form";
import { type NewItem, PRIORITIES, SPREAD_STRATEGIES } from "@/lib/items";
import { SLOT_MIN } from "@/lib/placements";
import { type Recurrence, WEEKDAYS } from "@/lib/recurrence";
import type { TimeZone } from "@/lib/time/time-zone";
import { firstOccurrence, withFirstDeadline } from "@/server/recurrence";
import { toDate } from "@/server/time/temporal";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);
const toNumber = (value: unknown) => {
  const present = emptyToUndefined(value);
  return typeof present === "string" ? Number(present) : present;
};

/** Local wall-clock time as sent by `<input type="datetime-local">`, e.g. "2026-10-01T14:00". */
const localDateTime = z.iso.datetime({ local: true, error: "Enter a date and time" });
const localTime = z.iso.time({ precision: -1, error: "Enter a time" });
const DURATION_ERROR = "Enter a duration, like 1h 30m";
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
    startTime: localTime,
    endTime: localTime,
    location: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
    bufferBeforeMin: z.preprocess(toNumber, minutes(0).default(0)),
    bufferAfterMin: z.preprocess(toNumber, minutes(0).default(0)),
  })
  .refine((form) => form.startTime !== form.endTime, { path: ["endTime"], message: "End must differ from start" })
  .refine(weekdaysChosen.check, weekdaysChosen.params);

const flexibleForm = z
  .object({
    ...shared,
    timing: z.literal("flexible"),
    durationMin: z.preprocess(toNumber, taskMinutes),
    earliestStart: z.preprocess(emptyToUndefined, localDateTime.optional()),
    deadline: z.preprocess(emptyToUndefined, localDateTime.optional()),
    minChunkMin: z.preprocess(toNumber, taskMinutes.optional()),
    maxChunkMin: z.preprocess(toNumber, taskMinutes.optional()),
    spread: z.preprocess(emptyToUndefined, z.enum(SPREAD_STRATEGIES).default("asap")),
    catchUp: z.preprocess(emptyToUndefined, z.enum(CATCH_UP_OPTIONS).default("later")),
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
  .refine((form) => (form.minChunkMin === undefined) === (form.maxChunkMin === undefined), {
    path: ["maxChunkMin"],
    message: "Enter both block lengths",
    ...evenIfInvalid,
  })
  .refine(
    (form) => form.minChunkMin === undefined || form.maxChunkMin === undefined || form.minChunkMin <= form.maxChunkMin,
    {
      path: ["maxChunkMin"],
      message: "Longest block must be at least the shortest",
    },
  );

const itemFormSchema = z.discriminatedUnion("timing", [fixedForm, flexibleForm]);

export type ParsedItemForm = { ok: true; item: NewItem } | { ok: false; errors: FormErrors };

/**
 * Validates submitted form fields and converts their local times to exact times in `timeZone`. A fixed item ending at
 * an earlier time than it starts ends the next day.
 * A one-off flexible task without an earliest start starts at `now`, and its deadline must be after `now`.
 * A recurring item must occur at least once; a recurring task is due when its first occurrence's window ends. Only a
 * recurring task can be kept within its period.
 */
export function parseItemForm(fields: Record<string, unknown>, timeZone: TimeZone, now: Date): ParsedItemForm {
  const parsed = itemFormSchema.safeParse(fields);
  if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors };

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
    const endsNextDay = form.endTime < form.startTime;
    const item: NewItem = {
      title: form.title,
      priority: form.priority,
      timing: "fixed",
      recurrence,
      categoryId: form.category ?? null,
      start: at(`${form.date}T${form.startTime}`),
      end: at(`${endsNextDay ? Temporal.PlainDate.from(form.date).add({ days: 1 }) : form.date}T${form.endTime}`),
      location: form.location ?? null,
      bufferBeforeMin: form.bufferBeforeMin,
      bufferAfterMin: form.bufferAfterMin,
    };
    return recurrence && !firstOccurrence(item, timeZone) ? neverOccurs : { ok: true, item };
  }

  const task = {
    title: form.title,
    priority: form.priority,
    timing: "flexible" as const,
    recurrence,
    categoryId: form.category ?? null,
    durationMin: form.durationMin,
    split:
      form.minChunkMin !== undefined && form.maxChunkMin !== undefined
        ? { minChunkMin: form.minChunkMin, maxChunkMin: form.maxChunkMin }
        : null,
    spread: form.spread,
    withinPeriod: recurrence !== null && form.catchUp === "in-period",
  };
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
  return { ok: true, item: { ...task, earliestStart, deadline } };
}
