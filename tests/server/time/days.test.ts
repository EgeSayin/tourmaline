import { describe, expect, it } from "vitest";
import { dayNavigation, daysFrom, parseDateParam, weekNavigation, weekOf } from "@/server/time/days";
import { localDate } from "@/server/time/temporal";

describe("weekOf", () => {
  it("returns the local Monday-to-Monday week, including at its edges and across DST", () => {
    const tz = "America/New_York";
    const weekAt = (iso: string) => weekOf(localDate(new Date(iso), tz), tz);

    // Thu Oct 8 2026, 11:00 EDT.
    const week = weekAt("2026-10-08T15:00Z");
    expect(week.dates).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    expect(week.range).toEqual({ start: new Date("2026-10-05T04:00Z"), end: new Date("2026-10-12T04:00Z") });
    expect(weekOf(Temporal.PlainDate.from("2026-10-11"), tz)).toEqual(week); // any day of the week, Sunday included

    // Mon 00:00 starts the new week; Sun 23:59 still belongs to the old one.
    expect(weekAt("2026-10-12T04:00Z").dates[0]).toBe("2026-10-12");
    expect(weekAt("2026-10-12T03:59Z").dates[0]).toBe("2026-10-05");

    // Clocks go back on Sun Nov 1, so this week starts in EDT and ends in EST: 169 hours.
    expect(weekAt("2026-11-01T12:00Z").range).toEqual({
      start: new Date("2026-10-26T04:00Z"),
      end: new Date("2026-11-02T05:00Z"),
    });

    // Three days from Sat Oct 31 span the change too: EDT midnight to EST midnight.
    expect(daysFrom(Temporal.PlainDate.from("2026-10-31"), 3, tz)).toEqual({
      dates: ["2026-10-31", "2026-11-01", "2026-11-02"],
      range: { start: new Date("2026-10-31T04:00Z"), end: new Date("2026-11-03T05:00Z") },
    });
  });

  it("parses the date parameter and links to the weeks and days around it", () => {
    expect(parseDateParam("2026-10-08")?.toString()).toBe("2026-10-08");
    for (const invalid of [undefined, "", "next", "2026-13-01", "2026-10-08T10:00", ["2026-10-08", "2026-10-15"]]) {
      expect(parseDateParam(invalid)).toBeUndefined();
    }

    expect(weekNavigation("2026-10-05", "2026-10-07")).toEqual({
      previous: "2026-09-28",
      next: "2026-10-12",
      weeksFromToday: 0,
    });
    expect(weekNavigation("2026-09-28", "2026-10-11").weeksFromToday).toBe(-1); // Sunday is still the later week
    expect(weekNavigation("2026-11-02", "2026-10-05").weeksFromToday).toBe(4); // across the DST change

    expect(dayNavigation("2026-10-30", 3)).toEqual({ previous: "2026-10-27", next: "2026-11-02" }); // across months
  });
});
