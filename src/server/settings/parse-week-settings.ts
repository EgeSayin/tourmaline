import { z } from "zod";
import { DOWNTIME_STEPS, fromSteps } from "@/lib/downtime";
import type { FormErrors } from "@/lib/form-state";
import { WEEKDAYS } from "@/lib/recurrence";
import { downtimeField, focusCapField, type SchedulerSettings } from "@/lib/settings";

export type ParsedWeekSettings =
  { ok: true; settings: Pick<SchedulerSettings, "downtime" | "focusCaps"> } | { ok: false; errors: FormErrors };

const MINUTES_PER_HOUR = 60;

const hours = z.preprocess(
  (value) => (value === "" || value === undefined ? null : Number(value)),
  z
    .number({ error: "Enter a number of hours" })
    .min(0, "Enter 0 to 24 hours")
    .max(24, "Enter 0 to 24 hours")
    .nullable(),
);

const steps = z.string().regex(new RegExp(`^[01]{${DOWNTIME_STEPS}}$`), "Paint downtime on the calendar");

/** Validates each weekday's downtime steps and cap in hours (empty for no cap, kept in whole minutes). */
export function parseWeekSettings(fields: Record<string, unknown>): ParsedWeekSettings {
  const parsed = z
    .object(
      Object.fromEntries(
        WEEKDAYS.flatMap((weekday) => [
          [focusCapField(weekday), hours],
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
      focusCaps: WEEKDAYS.map((weekday) => {
        const cap = field(focusCapField(weekday)) as number | null;
        return cap === null ? null : Math.round(cap * MINUTES_PER_HOUR);
      }),
    },
  };
}
