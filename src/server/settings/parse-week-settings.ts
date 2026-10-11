import { z } from "zod";
import { DOWNTIME_STEPS, fromSteps } from "@/lib/downtime";
import type { FormErrors } from "@/lib/form-state";
import { WEEKDAYS } from "@/lib/recurrence";
import { MINUTES_PER_DAY } from "@/lib/time/time-of-day";
import { downtimeField, focusCapField, type SchedulerSettings } from "@/lib/settings";

export type ParsedWeekSettings =
  { ok: true; settings: Pick<SchedulerSettings, "downtime" | "focusCaps"> } | { ok: false; errors: FormErrors };

const cap = z.preprocess(
  (value) => (value === "" || value === undefined ? null : Number(value)),
  z
    .number({ error: "Enter a duration, like 6h" })
    .int()
    .min(0, "Enter up to 24h")
    .max(MINUTES_PER_DAY, "Enter up to 24h")
    .nullable(),
);

const steps = z.string().regex(new RegExp(`^[01]{${DOWNTIME_STEPS}}$`), "Paint downtime on the calendar");

/** Validates each weekday's downtime steps and cap in minutes, empty for no cap. */
export function parseWeekSettings(fields: Record<string, unknown>): ParsedWeekSettings {
  const parsed = z
    .object(
      Object.fromEntries(
        WEEKDAYS.flatMap((weekday) => [
          [focusCapField(weekday), cap],
          [downtimeField(weekday), steps],
        ]),
      ),
    )
    .safeParse(fields);
  if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors };

  const field = (name: string) => parsed.data[name] as string | number | null;
  return {
    ok: true,
    settings: {
      downtime: WEEKDAYS.map((weekday) =>
        fromSteps([...(field(downtimeField(weekday)) as string)].map((s) => s === "1")),
      ),
      focusCaps: WEEKDAYS.map((weekday) => field(focusCapField(weekday)) as number | null),
    },
  };
}
