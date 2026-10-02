import { describe, expect, it } from "vitest";
import type { FlexibleItem } from "@/lib/items";
import type { Interval } from "@/server/scheduler/intervals";
import { placeSingleBlock } from "@/server/scheduler/place";

function iv(start: string, end: string): Interval {
  return {
    start: new Date(`2026-10-05T${start}:00Z`),
    end: new Date(`2026-10-05T${end}:00Z`),
  };
}

function flexible(title: string, durationMin: number, window: Interval): FlexibleItem {
  return {
    id: title,
    title,
    priority: "normal",
    timing: "flexible",
    durationMin,
    earliestStart: window.start,
    deadline: window.end,
    split: null,
    preferredWindows: [],
    spread: "asap",
  };
}

describe("placeSingleBlock", { tags: ["unit", "critical"] }, () => {
  it("places tasks one after another without reusing time already taken", () => {
    const free = [iv("10:00", "10:45"), iv("12:30", "18:00"), iv("19:00", "22:30")];

    const essay = placeSingleBlock(flexible("Essay", 90, iv("00:00", "23:59")), free);
    expect(essay).toEqual({
      placement: { itemId: "Essay", ...iv("12:30", "14:00"), source: "auto", pinned: false },
      free: [iv("10:00", "10:45"), iv("14:00", "18:00"), iv("19:00", "22:30")],
    });

    const reading = placeSingleBlock(flexible("Reading", 60, iv("12:00", "15:30")), essay!.free);
    expect(reading?.placement).toMatchObject(iv("14:00", "15:00")); // essay already took 12:30–14:00
    expect(reading?.free).toEqual([iv("10:00", "10:45"), iv("15:00", "18:00"), iv("19:00", "22:30")]);

    // Only 15:00–17:00 is left before the deadline.
    expect(placeSingleBlock(flexible("Lab report", 3 * 60, iv("00:00", "17:00")), reading!.free)).toBeNull();
  });
});
