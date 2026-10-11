import { describe, expect, it } from "vitest";
import { parseWeekSettings } from "@/server/settings/parse-week-settings";

/** Half-hour steps: "1" from `from` up to `to`, both in hours. */
const painted = (...ranges: [number, number][]) =>
  Array.from({ length: 48 }, (_, step) =>
    ranges.some(([from, to]) => from * 2 <= step && step < to * 2) ? "1" : "0",
  ).join("");

describe("parseWeekSettings", () => {
  it("turns painted steps into each weekday's ranges and hours into minutes, and rejects anything else", () => {
    const night = painted([0, 8], [23, 24]);
    const week = {
      ...{ downtime1: night, downtime2: night, downtime3: painted([0, 8], [12, 13.5]), downtime4: night },
      ...{ downtime5: night, downtime6: painted([0, 10]), downtime7: painted() },
      ...{ cap1: "8", cap2: "7.5", cap3: "0", cap4: "", cap5: "6.25", cap6: "4" },
    };
    const nightRanges = [
      { startMinute: 0, endMinute: 480 },
      { startMinute: 1380, endMinute: 1440 },
    ];

    expect(parseWeekSettings(week)).toEqual({
      ok: true,
      settings: {
        downtime: [
          nightRanges,
          nightRanges,
          [
            { startMinute: 0, endMinute: 480 },
            { startMinute: 720, endMinute: 810 },
          ],
          nightRanges,
          nightRanges,
          [{ startMinute: 0, endMinute: 600 }],
          [],
        ],
        focusCaps: [480, 450, 0, null, 375, 240, null],
      },
    });
    expect(parseWeekSettings({ ...week, downtime2: "01", cap2: "25", cap3: "-1", cap4: "a lot" })).toEqual({
      ok: false,
      errors: {
        downtime2: ["Paint downtime on the calendar"],
        cap2: ["Enter 0 to 24 hours"],
        cap3: ["Enter 0 to 24 hours"],
        cap4: ["Enter a number of hours"],
      },
    });
  });
});
