import { describe, expect, it } from "vitest";
import type { FixedItem } from "@/lib/items";
import type { SchedulerSettings } from "@/lib/settings";
import { freeTimeMap } from "@/server/scheduler/free-time";

function utc(start: string, end: string) {
  return { start: new Date(`${start}Z`), end: new Date(`${end}Z`) };
}

function fixed(title: string, start: string, end: string, bufferMin = 0): FixedItem {
  return {
    id: title,
    title,
    priority: "mandatory",
    timing: "fixed",
    ...utc(start, end),
    location: null,
    bufferBeforeMin: bufferMin,
    bufferAfterMin: bufferMin,
  };
}

describe("freeTimeMap", { tags: ["unit", "critical"] }, () => {
  it("removes downtime and fixed items with their buffers from the range", () => {
    const settings: SchedulerSettings = {
      timeZone: "America/New_York",
      downtime: { startMinute: 23 * 60, endMinute: 10 * 60 },
    };
    // Mon Oct 5 2026, 00:00–24:00 EDT (UTC-4).
    const range = utc("2026-10-05T04:00", "2026-10-06T04:00");
    const items = [
      fixed("Lecture", "2026-10-05T15:00", "2026-10-05T16:15", 15), // 11:00–12:15, 15 min buffers
      fixed("Club", "2026-10-05T22:00", "2026-10-05T23:00"), // 18:00–19:00
      fixed("Call", "2026-10-06T02:30", "2026-10-06T03:30"), // 22:30–23:30, runs into downtime
      fixed("Tomorrow", "2026-10-06T15:00", "2026-10-06T16:00"), // outside the range
    ];

    expect(freeTimeMap(range, items, settings)).toEqual([
      utc("2026-10-05T14:00", "2026-10-05T14:45"), // 10:00–10:45
      utc("2026-10-05T16:30", "2026-10-05T22:00"), // 12:30–18:00
      utc("2026-10-05T23:00", "2026-10-06T02:30"), // 19:00–22:30
    ]);
  });
});
