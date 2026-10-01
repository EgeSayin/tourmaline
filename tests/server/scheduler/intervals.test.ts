import { describe, expect, it } from "vitest";
import { type Interval, mergeIntervals, subtractIntervals } from "@/server/scheduler/intervals";

function iv(start: string, end: string): Interval {
  return {
    start: new Date(`2026-10-05T${start}:00Z`),
    end: new Date(`2026-10-05T${end}:00Z`),
  };
}

describe("mergeIntervals", () => {
  it("sorts busy blocks and merges overlapping, touching, and nested ones", () => {
    const busy = [
      iv("16:00", "17:00"),
      iv("10:00", "11:30"),
      iv("11:00", "12:00"), // overlaps previous
      iv("12:00", "12:45"), // touches previous
      iv("14:00", "18:00"),
      iv("15:00", "15:30"), // nested in previous
    ];
    const snapshot = structuredClone(busy);

    expect(mergeIntervals(busy)).toEqual([iv("10:00", "12:45"), iv("14:00", "18:00")]);
    expect(busy).toEqual(snapshot);
    expect(mergeIntervals([])).toEqual([]);
  });
});

describe("subtractIntervals", () => {
  it("removes busy blocks from free time, splitting and trimming as needed", () => {
    const free = [iv("14:00", "20:00"), iv("10:00", "12:00")];
    const busy = [
      iv("09:00", "10:30"), // trims the start of a free slot
      iv("13:00", "13:30"), // between free slots, no effect
      iv("15:00", "16:00"), // splits a free slot
      iv("15:30", "17:00"), // overlaps the previous busy block
      iv("19:00", "21:00"), // trims the end of a free slot
    ];

    expect(subtractIntervals(free, busy)).toEqual([
      iv("10:30", "12:00"),
      iv("14:00", "15:00"),
      iv("17:00", "19:00"),
    ]);
    expect(subtractIntervals(free, [])).toEqual([iv("10:00", "12:00"), iv("14:00", "20:00")]);
    expect(subtractIntervals(free, [iv("08:00", "22:00")])).toEqual([]);
  });
});
