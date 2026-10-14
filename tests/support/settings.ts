import fc from "fast-check";
import { DAY_STEPS, fromSteps } from "@/lib/time/day-steps";
import type { SchedulerSettings } from "@/lib/settings";

const downtimeArb = fc.array(fc.array(fc.boolean(), { minLength: DAY_STEPS, maxLength: DAY_STEPS }).map(fromSteps), {
  minLength: 7,
  maxLength: 7,
});

/** UTC keeps local time equal to generated UTC minutes; time zone handling is covered by the `weeklyIntervals` tests. */
export const utcSettingsArb: fc.Arbitrary<SchedulerSettings> = fc.record({
  timeZone: fc.constant("UTC"),
  downtime: downtimeArb,
});
