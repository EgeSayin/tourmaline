import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Recurrence, WEEKDAYS } from "@/lib/recurrence";
import { expandOccurrences, occurrenceDates } from "@/server/recurrence";
import { utc } from "../support/intervals";
import { fixed, flexible } from "../support/items";

const day = (iso: string) => Temporal.PlainDate.from(iso);
const expand = (rule: Recurrence, first: string, from: string, to: string) =>
  occurrenceDates(rule, day(first), day(from), day(to)).map(String);

describe("occurrenceDates", { tags: ["unit", "critical"] }, () => {
  it("repeats every N days from the first date, clipped to the range and the until date", () => {
    const everyOtherDay: Recurrence = { frequency: "daily", interval: 2, until: null };

    // Thu Oct 1 2026 onwards; the range starts mid-series and on a non-occurrence day.
    expect(expand(everyOtherDay, "2026-10-01", "2026-10-04", "2026-10-10")).toEqual([
      "2026-10-05",
      "2026-10-07",
      "2026-10-09",
    ]);
    // Nothing before the first date, and `to` is exclusive.
    expect(expand(everyOtherDay, "2026-10-01", "2026-09-01", "2026-10-05")).toEqual(["2026-10-01", "2026-10-03"]);
    // `until` is inclusive.
    expect(expand({ ...everyOtherDay, until: "2026-10-05" }, "2026-10-01", "2026-10-01", "2026-12-01")).toEqual([
      "2026-10-01",
      "2026-10-03",
      "2026-10-05",
    ]);
    // A range entirely before the first date or after the until date is empty.
    expect(expand(everyOtherDay, "2026-10-01", "2026-09-01", "2026-10-01")).toEqual([]);
    expect(expand({ ...everyOtherDay, until: "2026-10-05" }, "2026-10-01", "2026-10-06", "2026-12-01")).toEqual([]);
  });

  it("repeats on chosen weekdays every N weeks, counting weeks from the first date's Monday", () => {
    // Every other week on Fri and Mon (unsorted on purpose), first date Wed Oct 7 2026.
    const rule: Recurrence = { frequency: "weekly", interval: 2, weekdays: [5, 1], until: null };

    expect(expand(rule, "2026-10-07", "2026-10-01", "2026-11-03")).toEqual([
      // Mon Oct 5 is in the first week but before the first date.
      "2026-10-09",
      // The week of Oct 12 is skipped.
      "2026-10-19",
      "2026-10-23",
      "2026-11-02",
    ]);
    // A range starting in a skipped week, far from the first date.
    expect(expand(rule, "2026-10-07", "2027-01-05", "2027-01-20")).toEqual(["2027-01-11", "2027-01-15"]);
    // Weekly on Sunday with an until date on a Saturday.
    expect(
      expand(
        { frequency: "weekly", interval: 1, weekdays: [7], until: "2026-10-24" },
        "2026-10-04",
        "2026-10-01",
        "2027-01-01",
      ),
    ).toEqual(["2026-10-04", "2026-10-11", "2026-10-18"]);
  });

  it("gives the same dates for a range as for its two halves", { tags: ["property"] }, () => {
    const offset = (max: number) => fc.integer({ min: 0, max });
    const ruleArb: fc.Arbitrary<Recurrence> = fc.oneof(
      fc.record({
        frequency: fc.constant("daily" as const),
        interval: fc.integer({ min: 1, max: 9 }),
        until: fc.constant(null),
      }),
      fc.record({
        frequency: fc.constant("weekly" as const),
        interval: fc.integer({ min: 1, max: 4 }),
        weekdays: fc.subarray([...WEEKDAYS], { minLength: 1 }),
        until: fc.constant(null),
      }),
    );
    const origin = day("2026-01-01");

    fc.assert(
      fc.property(ruleArb, offset(60), offset(200), offset(200), offset(200), (rule, first, a, b, c) => {
        const [from, mid, to] = [a, b, c].sort((x, y) => x - y).map((days) => origin.add({ days }));
        const start = origin.add({ days: first });
        const whole = occurrenceDates(rule, start, from, to).map(String);
        const halves = [...occurrenceDates(rule, start, from, mid), ...occurrenceDates(rule, start, mid, to)].map(
          String,
        );

        expect(halves).toEqual(whole);
        expect([...whole].sort()).toEqual(whole);
        expect(new Set(whole).size).toBe(whole.length);
      }),
    );
  });
});

describe("expandOccurrences", { tags: ["unit", "critical"] }, () => {
  const tz = "America/New_York";
  const ids = (items: { id: string }[]) => items.map((item) => item.id);

  it("places fixed occurrences at the first one's local times, skipping dates and stopping at until", () => {
    const lecture = {
      ...fixed("Lecture", utc("2026-10-26T15:00", "2026-10-26T16:15")), // Mon 11:00 EDT
      recurrence: { frequency: "weekly", interval: 1, weekdays: [1, 3], until: "2026-11-09" } satisfies Recurrence,
      overrides: [
        { date: "2026-10-28", skipped: true },
        { date: "2026-11-02", skipped: false }, // still occurs
      ],
    };
    const times = (start: string, end: string) => ({ ...lecture, ...utc(start, end) });

    // Clocks go back on Sun Nov 1: still 11:00 local, now EST.
    expect(expandOccurrences(lecture, utc("2026-10-26T04:00", "2026-11-30T05:00"), tz)).toEqual([
      { ...times("2026-10-26T15:00", "2026-10-26T16:15"), id: "Lecture@2026-10-26" },
      { ...times("2026-11-02T16:00", "2026-11-02T17:15"), id: "Lecture@2026-11-02" },
      { ...times("2026-11-04T16:00", "2026-11-04T17:15"), id: "Lecture@2026-11-04" },
      { ...times("2026-11-09T16:00", "2026-11-09T17:15"), id: "Lecture@2026-11-09" },
    ]);
    // Overlap is exclusive at both ends: one starting mid-lecture counts, one ending at a start doesn't.
    expect(ids(expandOccurrences(lecture, utc("2026-10-26T16:00", "2026-11-02T16:00"), tz))).toEqual([
      "Lecture@2026-10-26",
    ]);

    // Starting two dates before the range: clocks go forward on Sun Mar 8, so a shift from Sat 23:30 to Mon 00:05
    // is under a day long but ends two dates later.
    const shift = {
      ...fixed("Shift", utc("2026-03-08T04:30", "2026-03-09T04:05")),
      recurrence: { frequency: "weekly", interval: 1, weekdays: [6], until: null } satisfies Recurrence,
    };
    expect(ids(expandOccurrences(shift, utc("2026-03-09T04:00", "2026-03-09T04:30"), tz))).toEqual([
      "Shift@2026-03-07",
    ]);

    // 02:30 doesn't exist on Sun Mar 8, so that occurrence starts at 03:30 and keeps its 30 minutes.
    const backup = {
      ...fixed("Backup", utc("2026-03-06T07:30", "2026-03-06T08:00")), // Fri 02:30–03:00 EST
      recurrence: { frequency: "daily", interval: 1, until: null } satisfies Recurrence,
    };
    expect(expandOccurrences(backup, utc("2026-03-08T05:00", "2026-03-09T04:00"), tz)).toEqual([
      { ...backup, ...utc("2026-03-08T07:30", "2026-03-08T08:00"), id: "Backup@2026-03-08" },
    ]);
  });

  it("gives each task occurrence a window that runs until the rule next occurs", () => {
    const gym = {
      ...flexible("Gym", 60, utc("2026-10-05T14:00", "2026-10-09T14:00")), // Mon 10:00 EDT to Fri 10:00
      recurrence: { frequency: "weekly", interval: 1, weekdays: [1, 5], until: "2026-10-16" } satisfies Recurrence,
      overrides: [{ date: "2026-10-12", skipped: true }],
    };
    const window = (start: string, end: string) => {
      const { start: earliestStart, end: deadline } = utc(start, end);
      return { ...gym, earliestStart, deadline };
    };

    expect(expandOccurrences(gym, utc("2026-10-05T04:00", "2026-11-02T05:00"), tz)).toEqual([
      { ...window("2026-10-05T14:00", "2026-10-09T14:00"), id: "Gym@2026-10-05" },
      // Ends where the skipped Monday would have started.
      { ...window("2026-10-09T14:00", "2026-10-12T14:00"), id: "Gym@2026-10-09" },
      // The last one still runs until the Monday after `until`.
      { ...window("2026-10-16T14:00", "2026-10-19T14:00"), id: "Gym@2026-10-16" },
    ]);
    // A Saturday is inside Friday's window.
    expect(ids(expandOccurrences(gym, utc("2026-10-10T04:00", "2026-10-11T04:00"), tz))).toEqual(["Gym@2026-10-09"]);
  });

  it("returns a one-off item unchanged, whatever the range", () => {
    const essay = flexible("Essay", 60, utc("2026-10-05T14:00", "2026-10-09T14:00"));

    expect(expandOccurrences(essay, utc("2027-01-01T00:00", "2027-01-02T00:00"), tz)).toEqual([essay]);
  });
});
