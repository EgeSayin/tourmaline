import { describe, expect, it } from "vitest";
import { parseWeekParam, planningHorizon, weekContaining, weekNavigation, weekOf } from "@/server/week";
import { flexible } from "../support/items";
import { utc } from "../support/intervals";

const at = (iso: string) => Temporal.Instant.from(iso);

describe("weekContaining and weekOf", { tags: ["unit", "critical"] }, () => {
  it("returns the local Monday-to-Monday week, including at its edges and across DST", () => {
    const tz = "America/New_York";

    // Thu Oct 8 2026, 11:00 EDT.
    const week = weekContaining(at("2026-10-08T15:00Z"), tz);
    expect(week.monday.toString()).toBe("2026-10-05");
    expect(week.range).toEqual({ start: new Date("2026-10-05T04:00Z"), end: new Date("2026-10-12T04:00Z") });
    expect(weekOf(Temporal.PlainDate.from("2026-10-11"), tz)).toEqual(week); // any day of the week, Sunday included

    // Mon 00:00 starts the new week; Sun 23:59 still belongs to the old one.
    expect(weekContaining(at("2026-10-12T04:00Z"), tz).monday.toString()).toBe("2026-10-12");
    expect(weekContaining(at("2026-10-12T03:59Z"), tz).monday.toString()).toBe("2026-10-05");

    // Clocks go back on Sun Nov 1, so this week starts in EDT and ends in EST: 169 hours.
    expect(weekContaining(at("2026-11-01T12:00Z"), tz).range).toEqual({
      start: new Date("2026-10-26T04:00Z"),
      end: new Date("2026-11-02T05:00Z"),
    });
  });

  it("parses the week parameter and links to the weeks around it", () => {
    expect(parseWeekParam("2026-10-08")?.toString()).toBe("2026-10-08");
    for (const invalid of [undefined, "", "next", "2026-13-01", "2026-10-08T10:00", ["2026-10-08", "2026-10-15"]]) {
      expect(parseWeekParam(invalid)).toBeUndefined();
    }

    expect(weekNavigation("2026-10-05", "2026-10-07")).toEqual({
      previous: "2026-09-28",
      next: "2026-10-12",
      weeksFromToday: 0,
    });
    expect(weekNavigation("2026-09-28", "2026-10-11").weeksFromToday).toBe(-1); // Sunday is still the later week
    expect(weekNavigation("2026-11-02", "2026-10-05").weeksFromToday).toBe(4); // across the DST change
  });
});

describe("planningHorizon", { tags: ["unit", "critical"] }, () => {
  it("runs from the current week's start to the latest deadline, between the end of this week and the cap", () => {
    const tz = "America/New_York";
    const week = weekOf(Temporal.PlainDate.from("2026-10-07"), tz); // Oct 5 04:00Z to Oct 12 04:00Z
    const task = (deadline: string) => flexible(deadline, 60, utc("2026-10-01T00:00", deadline));

    expect(planningHorizon(week, [], 12, tz)).toEqual(week.range);
    expect(planningHorizon(week, [task("2026-10-02T00:00"), task("2026-10-09T00:00")], 12, tz)).toEqual(week.range);

    const later = [task("2026-10-09T00:00"), task("2026-10-21T15:00"), task("2026-10-14T00:00")];
    expect(planningHorizon(week, later, 12, tz)).toEqual(utc("2026-10-05T04:00", "2026-10-21T15:00"));

    // Twelve weeks end at local midnight starting Mon Dec 28, after clocks went back on Nov 1.
    const farOff = [task("2027-03-01T00:00")];
    expect(planningHorizon(week, farOff, 12, tz)).toEqual(utc("2026-10-05T04:00", "2026-12-28T05:00"));
    expect(planningHorizon(week, farOff, 1, tz)).toEqual(week.range);
  });
});
