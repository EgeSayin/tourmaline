import fc from "fast-check";
import { DOWNTIME_STEPS, fromSteps } from "@/lib/downtime";
import { NO_FOCUS_CAPS, type SchedulerSettings } from "@/lib/settings";

const MINUTES_PER_DAY = 24 * 60;

const downtimeArb = fc.array(
  fc.array(fc.boolean(), { minLength: DOWNTIME_STEPS, maxLength: DOWNTIME_STEPS }).map(fromSteps),
  { minLength: 7, maxLength: 7 },
);

/** UTC keeps local time equal to generated UTC minutes; time zone handling is covered by the `downtimeIntervals` tests. */
export const utcSettingsArb: fc.Arbitrary<SchedulerSettings> = fc.record({
  timeZone: fc.constant("UTC"),
  downtime: downtimeArb,
  focusCaps: fc.oneof(
    fc.constant(NO_FOCUS_CAPS),
    fc.array(fc.option(fc.integer({ min: 0, max: MINUTES_PER_DAY }), { nil: null }), { minLength: 7, maxLength: 7 }),
  ),
});
