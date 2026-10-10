import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/items";
import { SLOT_MIN } from "@/lib/placements";
import type { SchedulerSettings } from "@/lib/settings";
import { minutesBetween } from "@/lib/time/duration";
import type { DailyWindow } from "@/lib/time/time-of-day";
import { type Interval, mergeIntervals, subtractIntervals } from "@/lib/time/interval";
import { freeTimeMap } from "@/server/scheduler/free-time";
import { findEarliestChunks, findEarliestSlot, placeTasks } from "@/server/scheduler/placement";
import { at, covers, intervalArb, intervalsArb, iv, minuteOf, SPAN_MIN } from "../../support/intervals";
import { fixed, fixedItemArb, flexible, flexibleItemsArb } from "../../support/items";
import { utcSettingsArb } from "../../support/settings";

/** Earliest minute on the `SLOT_MIN` grid starting `durationMin` consecutive minutes inside both `free` and `window`. */
function earliestFittingMinute(free: readonly Interval[], window: Interval, durationMin: number): number | null {
  const run = new Array<number>(SPAN_MIN + 1).fill(0);
  for (let minute = SPAN_MIN - 1; minute >= 0; minute--) {
    run[minute] = covers(free, minute) && covers([window], minute) ? run[minute + 1] + 1 : 0;
  }
  const start = run.findIndex((length, minute) => minute % SLOT_MIN === 0 && length >= durationMin);
  return start === -1 ? null : start;
}

describe("findEarliestSlot", { tags: ["unit", "critical"] }, () => {
  it("returns the earliest free block that fits the duration inside the window", () => {
    const free = mergeIntervals([iv("10:00", "10:45"), iv("12:30", "18:00"), iv("19:00", "22:30")]);
    const day = iv("00:00", "23:59");

    expect(findEarliestSlot(free, 30, day)).toEqual(iv("10:00", "10:30"));
    expect(findEarliestSlot(free, 60, day)).toEqual(iv("12:30", "13:30")); // first slot too short
    expect(findEarliestSlot(free, 45, iv("00:00", "10:45"))).toEqual(iv("10:00", "10:45")); // ends exactly at deadline
    expect(findEarliestSlot(free, 60, iv("13:00", "23:59"))).toEqual(iv("13:00", "14:00")); // starts mid-slot
    expect(findEarliestSlot(free, 60, iv("00:00", "13:15"))).toBeNull(); // deadline cuts the slot short
    expect(findEarliestSlot(free, 6 * 60, day)).toBeNull(); // longer than any free block
    expect(findEarliestSlot(mergeIntervals([iv("10:03", "10:40")]), 30, day)).toEqual(iv("10:05", "10:35")); // rounded up to the grid
    expect(findEarliestSlot(mergeIntervals([iv("10:03", "10:29")]), 25, day)).toBeNull(); // fits only off the grid
  });

  it("returns a slot at the earliest grid minute that fits, or null when none does", { tags: ["property"] }, () => {
    const freeArb = intervalsArb.map(mergeIntervals);
    const durationArb = fc.integer({ min: 1, max: 8 * 60 });

    fc.assert(
      fc.property(freeArb, intervalArb(SPAN_MIN), durationArb, (free, window, durationMin) => {
        const start = earliestFittingMinute(free, window, durationMin);
        const expected = start === null ? null : { start: at(start), end: at(start + durationMin) };

        expect(findEarliestSlot(free, durationMin, window)).toEqual(expected);
      }),
    );
  });
});

describe("findEarliestChunks", { tags: ["unit", "critical"] }, () => {
  const split = { minChunkMin: 30, maxChunkMin: 60 };
  const free = mergeIntervals([iv("10:00", "11:00"), iv("11:10", "12:00"), iv("13:00", "17:00")]);
  const day = iv("00:00", "23:59");

  it("cuts a task into the earliest chunks that fit, with a break after each", () => {
    // 60, then 30 after the break (the slot left at 11:30 is short), then the last 60.
    expect(findEarliestChunks(free, 150, day, split, 30)).toEqual([
      iv("10:00", "11:00"),
      iv("11:30", "12:00"),
      iv("13:00", "14:00"),
    ]);
    // 60 and 10 would leave a chunk below the minimum, so 40 and 30.
    expect(findEarliestChunks(mergeIntervals([iv("13:00", "17:00")]), 70, day, split, 30)).toEqual([
      iv("13:00", "13:40"),
      iv("14:10", "14:40"),
    ]);
    // Shorter than the minimum: one short chunk.
    expect(findEarliestChunks(free, 20, day, split, 30)).toEqual([iv("10:00", "10:20")]);
    // Rounded up to the grid after a break that ends off it.
    expect(findEarliestChunks(free, 90, day, split, 23)).toEqual([iv("10:00", "11:00"), iv("11:25", "11:55")]);
  });

  it("returns null unless all of the time fits", () => {
    expect(findEarliestChunks(free, 120, iv("00:00", "12:00"), split, 30)).toBeNull(); // 90 fits before noon
    expect(findEarliestChunks(mergeIntervals([iv("10:00", "10:25")]), 30, day, split, 30)).toBeNull();
    // 50 can't be cut into chunks of 30 to 40.
    expect(findEarliestChunks(free, 50, day, { minChunkMin: 30, maxChunkMin: 40 }, 0)).toBeNull();
  });

  it(
    "returns chunks inside free time and the window, on the grid, sized and spaced as asked, adding up to the duration",
    { tags: ["property"] },
    () => {
      const freeArb = intervalsArb.map(mergeIntervals);
      const splitArb = fc
        .tuple(fc.integer({ min: 1, max: 120 }), fc.integer({ min: 0, max: 120 }))
        .map(([minChunkMin, extra]) => ({ minChunkMin, maxChunkMin: minChunkMin + extra }));
      const durationArb = fc.integer({ min: 1, max: 6 * 60 });
      const breakArb = fc.integer({ min: 0, max: 90 });

      fc.assert(
        fc.property(
          freeArb,
          intervalArb(SPAN_MIN),
          durationArb,
          splitArb,
          breakArb,
          (free, window, durationMin, split, breakMin) => {
            const chunks = findEarliestChunks(free, durationMin, window, split, breakMin);
            if (chunks === null) return;

            expect(chunks.reduce((sum, chunk) => sum + minutesBetween(chunk.start, chunk.end), 0)).toBe(durationMin);
            for (const [i, chunk] of chunks.entries()) {
              const length = minutesBetween(chunk.start, chunk.end);
              if (durationMin >= split.minChunkMin) expect(length).toBeGreaterThanOrEqual(split.minChunkMin);
              expect(length).toBeLessThanOrEqual(split.maxChunkMin);
              expect(minuteOf(chunk.start) % SLOT_MIN).toBe(0);
              expect(subtractIntervals([chunk], free)).toEqual([]);
              expect(chunk.start >= window.start && chunk.end <= window.end).toBe(true);
              if (i > 0) expect(minutesBetween(chunks[i - 1].end, chunk.start)).toBeGreaterThanOrEqual(breakMin);
            }
          },
        ),
      );
    },
  );
});

function utc(start: string, end: string): Interval {
  return { start: new Date(`${start}Z`), end: new Date(`${end}Z`) };
}

describe("placeTasks", { tags: ["unit", "critical"] }, () => {
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

    const result = placeTasks(tasks, freeTimeMap(range, fixedItems, settings), settings.timeZone);

    expect(result.placements).toEqual([
      { taskId: "Lunch", ...utc("2026-10-05T16:30", "2026-10-05T17:15"), source: "auto", pinned: false }, // 12:30
      { taskId: "Problem set", ...utc("2026-10-05T17:15", "2026-10-05T20:15"), source: "auto", pinned: false }, // 13:15
      { taskId: "Essay", ...utc("2026-10-05T20:15", "2026-10-05T21:45"), source: "auto", pinned: false }, // 16:15
    ]);
    // Most urgent, but after lunch only 4h45m is free before 18:00.
    expect(result.unplaced.map((task) => task.id)).toEqual(["Lab report"]);
  });

  it("prefers each task's preferred windows and falls back to its whole window when none fits", () => {
    const settings: SchedulerSettings = { timeZone: "UTC", downtime: { startMinute: 22 * 60, endMinute: 10 * 60 } };
    const day = iv("00:00", "23:59");
    const free = freeTimeMap(day, [fixed("Seminar", iv("18:00", "19:00"))], settings);
    const window = (startHour: number, endHour: number) => ({ startMinute: startHour * 60, endMinute: endHour * 60 });
    const withWindows = (task: Task, preferredWindows: DailyWindow[]) => ({ ...task, preferredWindows });
    const tasks = [
      withWindows(flexible("Lunch", 45, day), [window(12, 14)]),
      withWindows(flexible("Dinner", 60, day), [window(18, 19)]), // taken by the seminar
      withWindows(flexible("Reading", 30, day), [window(8, 9), window(20, 21)]), // the first is in downtime
      flexible("Email", 20, day),
    ];

    const { placements } = placeTasks(tasks, free, settings.timeZone);

    expect(placements.map(({ taskId, start, end }) => ({ taskId, start, end }))).toEqual([
      { taskId: "Dinner", ...iv("10:00", "11:00") },
      { taskId: "Lunch", ...iv("12:00", "12:45") },
      { taskId: "Reading", ...iv("20:00", "20:30") },
      { taskId: "Email", ...iv("11:00", "11:20") },
    ]);
  });

  it(
    "places tasks only in free time inside their windows, never overlapping, leaving out only tasks that can't fit",
    { tags: ["property"] },
    () => {
      const fixedItemsArb = fc.array(fixedItemArb, { maxLength: 6 });

      fc.assert(
        fc.property(
          intervalArb(SPAN_MIN),
          utcSettingsArb,
          fixedItemsArb,
          flexibleItemsArb,
          (range, settings, fixedItems, tasks) => {
            const free = freeTimeMap(range, fixedItems, settings);
            const { placements, unplaced } = placeTasks(tasks, free, settings.timeZone);
            const tasksById = new Map(tasks.map((task) => [task.id, task]));

            const outcomeIds = [...placements.map((p) => p.taskId), ...unplaced.map((task) => task.id)];
            expect(outcomeIds.toSorted()).toEqual([...tasksById.keys()].toSorted());

            for (const placement of placements) {
              const task = tasksById.get(placement.taskId)!;
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
              expect(
                findEarliestSlot(leftover, task.durationMin, { start: task.earliestStart, end: task.deadline }),
              ).toBeNull();
            }
          },
        ),
      );
    },
  );
});
