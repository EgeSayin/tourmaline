import fc from "fast-check";
import type { SchedulerSettings } from "@/lib/settings";

const MINUTES_PER_DAY = 24 * 60;

/** UTC keeps local time equal to generated UTC minutes; time zone handling is covered by downtime tests. */
export const utcSettingsArb: fc.Arbitrary<SchedulerSettings> = fc.record({
  timeZone: fc.constant("UTC"),
  downtime: fc.record({
    startMinute: fc.integer({ min: 0, max: MINUTES_PER_DAY - 1 }),
    endMinute: fc.integer({ min: 0, max: MINUTES_PER_DAY - 1 }),
  }),
});
