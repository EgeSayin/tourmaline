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

const week = z.object({ caps: z.array(cap), downtime: z.array(steps) });

/** Validates each weekday's downtime steps and cap in minutes, empty for no cap. */
export function parseWeekSettings(fields: Record<string, unknown>): ParsedWeekSettings {
  const parsed = week.safeParse({
    caps: WEEKDAYS.map((weekday) => fields[focusCapField(weekday)]),
    downtime: WEEKDAYS.map((weekday) => fields[downtimeField(weekday)]),
  });
  if (!parsed.success) {
    const errors: FormErrors = {};
    for (const { path, message } of parsed.error.issues) {
      const [list, day] = path as ["caps" | "downtime", number];
      const name = (list === "caps" ? focusCapField : downtimeField)(WEEKDAYS[day]);
      (errors[name] ??= []).push(message);
    }
    return { ok: false, errors };
  }

  return {
    ok: true,
    settings: {
      downtime: parsed.data.downtime.map((day) => fromSteps([...day].map((step) => step === "1"))),
      focusCaps: parsed.data.caps,
    },
  };
}
