import { z } from "zod";
import { type Item, PRIORITIES, SPREAD_STRATEGIES } from "./items";
import { toDateTimeInputValue } from "./local-time";
import { SLOT_MIN } from "./placements";
import type { TimeZone } from "./time-zone";

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

const shared = {
  title: z.string().trim().min(1, "Enter a title").max(200),
  priority: z.preprocess(emptyToUndefined, z.enum(PRIORITIES).default("normal")),
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
  .refine((form) => form.start < form.end, { path: ["end"], message: "End must be after start" });

const flexibleForm = z
  .object({
    ...shared,
    timing: z.literal("flexible"),
    durationMin: z.preprocess(toNumber, taskMinutes),
    earliestStart: z.preprocess(emptyToUndefined, localDateTime.optional()),
    deadline: localDateTime,
    minChunkMin: z.preprocess(toNumber, minutes(1).optional()),
    maxChunkMin: z.preprocess(toNumber, minutes(1).optional()),
    spread: z.preprocess(emptyToUndefined, z.enum(SPREAD_STRATEGIES).default("asap")),
  })
  .refine((form) => (form.minChunkMin === undefined) === (form.maxChunkMin === undefined), {
    path: ["maxChunkMin"],
    message: "Set both chunk sizes or neither",
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
  const shared = { title: item.title, priority: item.priority, timing: item.timing };

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
    deadline: local(item.deadline),
    minChunkMin: item.split ? String(item.split.minChunkMin) : "",
    maxChunkMin: item.split ? String(item.split.maxChunkMin) : "",
    spread: item.spread,
  };
}
