import { describe, expect, it } from "vitest";
import { downtimeIntervals } from "@/lib/scheduler/downtime";
import type { SchedulerSettings } from "@/lib/scheduler/types";

function utc(start: string, end: string) {
  return { start: new Date(`${start}Z`), end: new Date(`${end}Z`) };
}

describe("downtimeIntervals", () => {
  it("returns local overnight downtime as exact times, across a DST change, clipped to the range", () => {
    const settings: SchedulerSettings = {
      timeZone: "America/New_York",
      downtime: { startMinute: 23 * 60, endMinute: 10 * 60 },
    };
    // Sat Oct 31 08:00 EDT → Mon Nov 2 00:00 EST. Clocks go back at 02:00 on Sun Nov 1.
    const range = utc("2026-10-31T12:00", "2026-11-02T05:00");

    expect(downtimeIntervals(range, settings)).toEqual([
      utc("2026-10-31T12:00", "2026-10-31T14:00"), // Fri night's downtime, clipped to range start
      utc("2026-11-01T03:00", "2026-11-01T15:00"), // Sat night: 23:00 EDT → 10:00 EST, 12 real hours
      utc("2026-11-02T04:00", "2026-11-02T05:00"), // Sun night, clipped to range end
    ]);
  });
});
