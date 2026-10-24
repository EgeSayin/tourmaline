import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  clockFormatOfLocale,
  formatHour,
  formatTimeOfDay,
  formatTimeOfDayRange,
  fromReading,
  toReading,
} from "@/lib/time/clock";
import { MINUTES_PER_DAY } from "@/lib/time/time-of-day";

describe("clock", () => {
  it("reads every minute of the day back as itself on either clock", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MINUTES_PER_DAY - 1 }), fc.constantFrom("24h", "12h"), (minute, format) => {
        expect(fromReading(toReading(minute, format))).toBe(minute);
      }),
    );
  });

  it("writes midnight and noon as 12 AM and 12 PM, and rejects what no clock reads", () => {
    expect(toReading(0, "12h")).toEqual({ hours: 12, minutes: 0, period: "AM" });
    expect(toReading(12 * 60, "12h")).toEqual({ hours: 12, minutes: 0, period: "PM" });
    expect(fromReading({ hours: 12, minutes: 30, period: "AM" })).toBe(30);
    expect(fromReading({ hours: 1, minutes: 5, period: "PM" })).toBe(13 * 60 + 5);
    for (const reading of [
      { hours: 0, minutes: 0, period: "AM" as const },
      { hours: 13, minutes: 0, period: "PM" as const },
      { hours: 24, minutes: 0 },
      { hours: 9, minutes: 60 },
    ]) {
      expect(fromReading(reading)).toBeNull();
    }
  });

  it("formats times, ranges and hours on each clock", () => {
    expect(formatTimeOfDay(14 * 60 + 30, "24h")).toBe("14:30");
    expect(formatTimeOfDay(14 * 60 + 30, "12h")).toBe("2:30 PM");
    expect(formatTimeOfDayRange(23 * 60, MINUTES_PER_DAY, "24h")).toBe("23:00–24:00");
    expect(formatTimeOfDayRange(23 * 60, MINUTES_PER_DAY, "12h")).toBe("11:00 PM–12:00 AM");
    expect(formatTimeOfDayRange(14 * 60, 15 * 60 + 30, "12h")).toBe("2:00–3:30 PM");
    expect(formatTimeOfDayRange(11 * 60, 12 * 60 + 15, "12h")).toBe("11:00 AM–12:15 PM");
    expect(formatHour(0, "12h")).toBe("12 AM");
    expect(formatHour(14, "12h")).toBe("2 PM");
    expect(formatHour(14, "24h")).toBe("14:00");
  });

  it("picks the clock a browser language writes times on", () => {
    expect(clockFormatOfLocale("en-US")).toBe("12h");
    expect(clockFormatOfLocale("en")).toBe("12h");
    expect(clockFormatOfLocale("en-GB")).toBe("24h");
    expect(clockFormatOfLocale("tr-TR")).toBe("24h");
    expect(clockFormatOfLocale(undefined)).toBe("24h");
    expect(clockFormatOfLocale("not a locale!")).toBe("24h");
  });
});
