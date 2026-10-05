import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Recurrence, WEEKDAYS } from "@/lib/recurrence";
import { occurrenceDates } from "@/server/recurrence";

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
