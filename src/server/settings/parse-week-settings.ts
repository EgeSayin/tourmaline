import { z } from "zod";
import type { Downtime } from "@/lib/downtime";
import { DAY_STEPS, fromSteps } from "@/lib/time/day-steps";
import type { FormErrors } from "@/lib/form-state";
import { WEEKDAYS } from "@/lib/recurrence";
import { downtimeField } from "@/lib/settings";

export type ParsedWeekSettings = { ok: true; downtime: Downtime } | { ok: false; errors: FormErrors };

const steps = z.string().regex(new RegExp(`^[01]{${DAY_STEPS}}$`), "Paint downtime on the calendar");

/** Validates each weekday's painted downtime steps. */
export function parseWeekSettings(fields: Record<string, unknown>): ParsedWeekSettings {
  const parsed = z.array(steps).safeParse(WEEKDAYS.map((weekday) => fields[downtimeField(weekday)]));
  if (!parsed.success) {
    const errors: FormErrors = {};
    for (const { path, message } of parsed.error.issues) {
      (errors[downtimeField(WEEKDAYS[path[0] as number])] ??= []).push(message);
    }
    return { ok: false, errors };
  }
  return { ok: true, downtime: parsed.data.map((day) => fromSteps([...day].map((step) => step === "1"))) };
}
