import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { minutesBetween } from "@/lib/duration";
import type { SchedulerSettings } from "@/lib/settings";
import { freeTimeMap } from "@/server/scheduler/free-time";
import { type Interval, subtractIntervals } from "@/server/scheduler/intervals";
import { schedule } from "@/server/scheduler/schedule";
import { findEarliestSlot } from "@/server/scheduler/slots";
import { intervalArb, SPAN_MIN } from "../../support/intervals";
import { fixed, fixedItemArb, flexible, flexibleItemsArb } from "../../support/items";
import { utcSettingsArb } from "../../support/settings";

function utc(start: string, end: string): Interval {
  return { start: new Date(`${start}Z`), end: new Date(`${end}Z`) };
}

describe("schedule", { tags: ["unit", "critical"] }, () => {
  it("places the most urgent tasks first around fixed items and reports what doesn't fit", () => {
    const settings: SchedulerSettings = {
      timeZone: "America/New_York",
      downtime: { startMinute: 23 * 60, endMinute: 10 * 60 },
    };
    // Mon Oct 5 2026, 00:00–24:00 EDT (UTC-4). Free: 10:00–10:45, 12:30–18:00, 19:00–22:30.
    const range = utc("2026-10-05T04:00", "2026-10-06T04:00");
    const fixedItems = [
      fixed("Lecture", utc("2026-10-05T15:00", "2026-10-05T16:15"), 15), // 11:00–12:15
      fixed("Club", utc("2026-10-05T22:00", "2026-10-05T23:00")), // 18:00–19:00
      fixed("Call", utc("2026-10-06T02:30", "2026-10-06T03:30")), // 22:30–23:30
    ];
    const tasks = [
      flexible("Essay", 90, utc("2026-10-05T04:00", "2026-10-06T03:00")), // due 23:00
      flexible("Lunch", 45, utc("2026-10-05T15:30", "2026-10-05T18:30"), "mandatory"), // 11:30–14:30
      flexible("Problem set", 3 * 60, utc("2026-10-05T04:00", "2026-10-07T04:00")), // due Tue
      flexible("Lab report", 5 * 60, utc("2026-10-05T04:00", "2026-10-05T22:00")), // due 18:00
    ];

    const result = schedule(range, fixedItems, tasks, settings);

    expect(result.placements).toEqual([
      { itemId: "Lunch", ...utc("2026-10-05T16:30", "2026-10-05T17:15"), source: "auto", pinned: false }, // 12:30
      { itemId: "Problem set", ...utc("2026-10-05T17:15", "2026-10-05T20:15"), source: "auto", pinned: false }, // 13:15
      { itemId: "Essay", ...utc("2026-10-05T20:15", "2026-10-05T21:45"), source: "auto", pinned: false }, // 16:15
    ]);
    // Most urgent, but after lunch only 4h45m is free before 18:00.
    expect(result.unplaced.map((task) => task.id)).toEqual(["Lab report"]);
  });

  it("places tasks only in free time inside their windows, never overlapping, leaving out only tasks that can't fit", { tags: ["property"] }, () => {
    const fixedItemsArb = fc.array(fixedItemArb, { maxLength: 6 });

    fc.assert(
      fc.property(intervalArb(SPAN_MIN), utcSettingsArb, fixedItemsArb, flexibleItemsArb, (range, settings, fixedItems, tasks) => {
        const { placements, unplaced } = schedule(range, fixedItems, tasks, settings);
        const tasksById = new Map(tasks.map((task) => [task.id, task]));
        const free = freeTimeMap(range, fixedItems, settings);

        const outcomeIds = [...placements.map((p) => p.itemId), ...unplaced.map((task) => task.id)];
        expect(outcomeIds.toSorted()).toEqual([...tasksById.keys()].toSorted());

        for (const placement of placements) {
          const task = tasksById.get(placement.itemId)!;
          expect(minutesBetween(placement.start, placement.end)).toBe(task.durationMin);
          expect(placement.start >= task.earliestStart && placement.end <= task.deadline).toBe(true);
          expect(subtractIntervals([placement], free)).toEqual([]);
        }

        const byStart = placements.toSorted((a, b) => a.start.getTime() - b.start.getTime());
        for (let i = 1; i < byStart.length; i++) {
          expect(byStart[i - 1].end <= byStart[i].start).toBe(true);
        }

        const leftover = subtractIntervals(free, placements);
        for (const task of unplaced) {
          expect(findEarliestSlot(leftover, task.durationMin, { start: task.earliestStart, end: task.deadline })).toBeNull();
        }
      }),
    );
  });
});
