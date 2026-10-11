import "server-only";
import { z } from "zod";
import { WEEKDAYS } from "@/lib/recurrence";
import { type FocusCaps, focusCapField } from "@/lib/settings";

export type FocusCapsErrors = Partial<Record<string, string[]>>;

export type ParsedFocusCaps = { ok: true; focusCaps: FocusCaps } | { ok: false; errors: FocusCapsErrors };

const MINUTES_PER_HOUR = 60;

const hours = z.preprocess(
  (value) => (value === "" || value === undefined ? null : Number(value)),
  z
    .number({ error: "Enter a number of hours" })
    .min(0, "Enter 0 to 24 hours")
    .max(24, "Enter 0 to 24 hours")
    .nullable(),
);

/** Validates each weekday's cap in hours, empty for no cap, and converts it to whole minutes. */
export function parseFocusCaps(fields: Record<string, unknown>): ParsedFocusCaps {
  const parsed = z
    .object(Object.fromEntries(WEEKDAYS.map((weekday) => [focusCapField(weekday), hours])))
    .safeParse(fields);
  if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors };

  const caps = WEEKDAYS.map((weekday) => parsed.data[focusCapField(weekday)] as number | null);
  return { ok: true, focusCaps: caps.map((cap) => (cap === null ? null : Math.round(cap * MINUTES_PER_HOUR))) };
}
