import { z } from "zod";
import { PRIORITIES, SPREAD_STRATEGIES } from "./items";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);
const toNumber = (value: unknown) => {
  const present = emptyToUndefined(value);
  return typeof present === "string" ? Number(present) : present;
};

/** Local wall-clock time as sent by `<input type="datetime-local">`, e.g. "2026-10-01T14:00". */
const localDateTime = z.iso.datetime({ local: true, error: "Enter a date and time" });
const minutes = (min: number) => z.number({ error: "Enter a whole number of minutes" }).int().min(min);

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
    durationMin: z.preprocess(toNumber, minutes(1)),
    earliestStart: z.preprocess(emptyToUndefined, localDateTime.optional()),
    deadline: localDateTime,
    minChunkMin: z.preprocess(toNumber, minutes(1).optional()),
    maxChunkMin: z.preprocess(toNumber, minutes(1).optional()),
    spread: z.preprocess(emptyToUndefined, z.enum(SPREAD_STRATEGIES).default("even")),
  })
  .refine((form) => form.earliestStart === undefined || form.earliestStart < form.deadline, {
    path: ["deadline"],
    message: "Deadline must be after the earliest start",
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

export type ItemForm = z.infer<typeof itemFormSchema>;
