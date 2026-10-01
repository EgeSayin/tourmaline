import { describe, expect, it } from "vitest";
import type { Interval } from "@/server/scheduler/intervals";
import { findEarliestSlot } from "@/server/scheduler/slots";

function iv(start: string, end: string): Interval {
  return {
    start: new Date(`2026-10-05T${start}:00Z`),
    end: new Date(`2026-10-05T${end}:00Z`),
  };
}

describe("findEarliestSlot", { tags: ["unit", "critical"] }, () => {
  it("returns the earliest free block that fits the duration inside the window", () => {
    const free = [iv("10:00", "10:45"), iv("12:30", "18:00"), iv("19:00", "22:30")];
    const day = iv("00:00", "23:59");

    expect(findEarliestSlot(free, 30, day)).toEqual(iv("10:00", "10:30"));
    expect(findEarliestSlot(free, 60, day)).toEqual(iv("12:30", "13:30")); // first slot too short
    expect(findEarliestSlot(free, 45, iv("00:00", "10:45"))).toEqual(iv("10:00", "10:45")); // ends exactly at deadline
    expect(findEarliestSlot(free, 60, iv("13:00", "23:59"))).toEqual(iv("13:00", "14:00")); // starts mid-slot
    expect(findEarliestSlot(free, 60, iv("00:00", "13:15"))).toBeNull(); // deadline cuts the slot short
    expect(findEarliestSlot(free, 6 * 60, day)).toBeNull(); // longer than any free block
  });
});
