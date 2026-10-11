import { describe, expect, it } from "vitest";
import { type Downtime, nightly, shownMinutes } from "@/lib/downtime";

describe("shownMinutes", () => {
  it("leaves out only the downtime every weekday shares at either end of the day", () => {
    const nights = nightly(22 * 60, 8 * 60);
    expect(shownMinutes(nights)).toEqual({ startMinute: 8 * 60, endMinute: 22 * 60 });

    // Lunch is shown, a Saturday lie-in stays shown, and a late Friday keeps its evening shown.
    const week: Downtime = nights.map((day, index) =>
      index === 0
        ? [...day.slice(0, 1), { startMinute: 720, endMinute: 780 }, ...day.slice(1)]
        : index === 4
          ? [day[0], { startMinute: 23 * 60, endMinute: 24 * 60 }]
          : index === 5
            ? [{ startMinute: 0, endMinute: 11 * 60 }, day[1]]
            : day,
    );
    expect(shownMinutes(week)).toEqual({ startMinute: 8 * 60, endMinute: 23 * 60 });

    expect(shownMinutes([...nights.slice(1), []])).toEqual({ startMinute: 0, endMinute: 24 * 60 });
    expect(shownMinutes(Array.from({ length: 7 }, () => [{ startMinute: 0, endMinute: 24 * 60 }]))).toEqual({
      startMinute: 0,
      endMinute: 24 * 60,
    });
  });
});
