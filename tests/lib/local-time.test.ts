import { describe, expect, it } from "vitest";
import { localDatesInRange, toDateTimeInputValue, toLocal } from "@/lib/local-time";

describe("local time", { tags: ["unit"] }, () => {
  it("converts exact times to local dates and minutes across a DST change", () => {
    const tz = "America/New_York";

    // Clocks go back at 02:00 on Nov 1, so 01:30 happens twice.
    expect(toLocal(new Date("2026-11-01T05:30Z"), tz)).toEqual({ date: "2026-11-01", minuteOfDay: 90 }); // EDT
    expect(toLocal(new Date("2026-11-01T06:30Z"), tz)).toEqual({ date: "2026-11-01", minuteOfDay: 90 }); // EST

    // Sat Oct 31 08:00 EDT → Mon Nov 2 00:00 EST; the range ends exactly at Monday's start.
    const range = { start: new Date("2026-10-31T12:00Z"), end: new Date("2026-11-02T05:00Z") };
    expect(localDatesInRange(range, tz)).toEqual(["2026-10-31", "2026-11-01"]);

    expect(toDateTimeInputValue(new Date("2026-11-01T06:30Z"), tz)).toBe("2026-11-01T01:30");
    expect(toDateTimeInputValue(new Date("2026-10-05T03:05Z"), tz)).toBe("2026-10-04T23:05");
  });
});
