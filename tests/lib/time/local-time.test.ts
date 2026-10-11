import { describe, expect, it } from "vitest";
import { toDateTimeInputValue, toLocal } from "@/lib/time/local-time";

describe("local time", () => {
  it("converts exact times to local dates and minutes across a DST change", () => {
    const tz = "America/New_York";

    // Clocks go back at 02:00 on Nov 1, so 01:30 happens twice.
    expect(toLocal(new Date("2026-11-01T05:30Z"), tz)).toEqual({ date: "2026-11-01", minuteOfDay: 90 }); // EDT
    expect(toLocal(new Date("2026-11-01T06:30Z"), tz)).toEqual({ date: "2026-11-01", minuteOfDay: 90 }); // EST

    expect(toDateTimeInputValue(new Date("2026-11-01T06:30Z"), tz)).toBe("2026-11-01T01:30");
    expect(toDateTimeInputValue(new Date("2026-10-05T03:05Z"), tz)).toBe("2026-10-04T23:05");
  });
});
