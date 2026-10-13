import { describe, expect, it } from "vitest";
import { nightly } from "@/lib/downtime";
import { weeklyIntervals } from "@/server/time/weekly-ranges";
import { utc } from "../../support/intervals";

describe("weeklyIntervals", () => {
  it("returns each weekday's local ranges as exact times, joined across midnight and DST changes, clipped to the range", () => {
    const overnight = nightly(23 * 60, 10 * 60);
    const timeZone = "America/New_York";
    // Sat Oct 31 08:00 EDT → Mon Nov 2 00:00 EST. Clocks go back at 02:00 on Sun Nov 1.
    const range = utc("2026-10-31T12:00", "2026-11-02T05:00");

    expect(weeklyIntervals(range, overnight, timeZone)).toEqual([
      utc("2026-10-31T12:00", "2026-10-31T14:00"), // Fri night's window, clipped to range start
      utc("2026-11-01T03:00", "2026-11-01T15:00"), // Sat night: 23:00 EDT → 10:00 EST, 12 real hours
      utc("2026-11-02T04:00", "2026-11-02T05:00"), // Sun night, clipped to range end
    ]);

    // Sat Mar 13 2027 12:00 EST → Sun Mar 14 12:00 EDT. Clocks jump from 02:00 to 03:00 on Sun.
    expect(weeklyIntervals(utc("2027-03-13T17:00", "2027-03-14T16:00"), overnight, timeZone)).toEqual([
      utc("2027-03-14T04:00", "2027-03-14T14:00"), // 23:00 EST → 10:00 EDT, 10 real hours
    ]);
  });
});
