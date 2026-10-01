import { describe, expect, it } from "vitest";
import { mergeIntervals } from "@/lib/scheduler/intervals";
import type { Interval } from "@/lib/scheduler/types";

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
