import { z } from "zod";
import { type Item, PRIORITIES, SPREAD_STRATEGIES } from "./items";
import { toDateTimeInputValue } from "@/lib/time/local-time";
import { SLOT_MIN } from "./placements";
import { WEEKDAYS } from "./recurrence";
import type { TimeZone } from "@/lib/time/time-zone";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);
const toNumber = (value: unknown) => {
  const present = emptyToUndefined(value);
  return typeof present === "string" ? Number(present) : present;
};

/** Local wall-clock time as sent by `<input type="datetime-local">`, e.g. "2026-10-01T14:00". */
const localDateTime = z.iso.datetime({ local: true, error: "Enter a date and time" });
const minutes = (min: number) => z.number({ error: "Enter a whole number of minutes" }).int().min(min);
const taskMinutes = z
  .number({ error: "Enter a whole number of minutes" })
  .min(SLOT_MIN)
  .multipleOf(SLOT_MIN, `Use multiples of ${SLOT_MIN} minutes`);

export const REPEAT_OPTIONS = ["none", "daily", "weekly"] as const;

export type Repeat = (typeof REPEAT_OPTIONS)[number];

/** Comma-separated ISO weekday numbers, e.g. "1,3,5", as kept by the weekday toggles. */
const weekdayList = z
  .string()
  .transform((value) => value.split(",").filter(Boolean).map(Number))
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
    start: localDateTime,
    end: localDateTime,
    location: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
    bufferBeforeMin: z.preprocess(toNumber, minutes(0).default(0)),
    bufferAfterMin: z.preprocess(toNumber, minutes(0).default(0)),
  })
  .refine((form) => form.start < form.end, { path: ["end"], message: "End must be after start" })
  .refine(weekdaysChosen.check, weekdaysChosen.params);

const flexibleForm = z
  .object({
    ...shared,
    timing: z.literal("flexible"),
    durationMin: z.preprocess(toNumber, taskMinutes),
    earliestStart: z.preprocess(emptyToUndefined, localDateTime.optional()),
    /** Not asked for a recurring task: each occurrence is due when the next one starts. */
    deadline: z.preprocess(emptyToUndefined, localDateTime.optional()),
    minChunkMin: z.preprocess(toNumber, taskMinutes.optional()),
    maxChunkMin: z.preprocess(toNumber, taskMinutes.optional()),
    spread: z.preprocess(emptyToUndefined, z.enum(SPREAD_STRATEGIES).default("asap")),
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
    message: "Set both chunk sizes or neither",
    ...evenIfInvalid,
  })
  .refine(
    (form) => form.minChunkMin === undefined || form.maxChunkMin === undefined || form.minChunkMin <= form.maxChunkMin,
    {
      path: ["maxChunkMin"],
      message: "Maximum chunk must be at least the minimum",
    },
  );

export const itemFormSchema = z.discriminatedUnion("timing", [fixedForm, flexibleForm]);

/** The form field values that describe `item`, with times shown in `timeZone`. */
export function itemToFormValues(item: Item, timeZone: TimeZone): Record<string, string> {
  const local = (date: Date) => toDateTimeInputValue(date, timeZone);
  const { recurrence } = item;
  const shared = {
    title: item.title,
    priority: item.priority,
    timing: item.timing,
    repeat: recurrence?.frequency ?? "none",
    interval: String(recurrence?.interval ?? 1),
    weekdays: recurrence?.frequency === "weekly" ? recurrence.weekdays.join(",") : "",
    until: recurrence?.until ?? "",
    category: item.categoryId ?? "",
  };

  if (item.timing === "fixed") {
    return {
      ...shared,
      start: local(item.start),
      end: local(item.end),
      location: item.location ?? "",
      bufferBeforeMin: String(item.bufferBeforeMin),
      bufferAfterMin: String(item.bufferAfterMin),
    };
  }
  return {
    ...shared,
    durationMin: String(item.durationMin),
    earliestStart: local(item.earliestStart),
    deadline: recurrence ? "" : local(item.deadline),
    minChunkMin: item.split ? String(item.split.minChunkMin) : "",
    maxChunkMin: item.split ? String(item.split.maxChunkMin) : "",
    spread: item.spread,
  };
}
