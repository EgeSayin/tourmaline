import { nightly } from "@/lib/downtime";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Split, SpreadStrategy } from "@/lib/items";
import type { SchedulerSettings } from "@/lib/settings";
import { minutesBetween } from "@/lib/time/duration";
import { intersectIntervals, mergeIntervals, subtractIntervals } from "@/lib/time/interval";
import { freeTimeMap } from "@/server/scheduler/free-time";
import { placeTasks } from "@/server/scheduler/placement";
import { planTask } from "@/server/scheduler/task-time";
import { findEarliestSlot } from "@/server/scheduler/search";
import { intervalArb, iv, SPAN_MIN, utc } from "../../support/intervals";
import { fixed, fixedItemArb, flexible, flexibleItemsArb, inRequiredHours, requiredTime } from "../../support/items";
import { utcSettingsArb } from "../../support/settings";

describe("placeTasks", () => {
  it("places the most urgent tasks first around fixed items and reports what doesn't fit", () => {
    const settings: SchedulerSettings = {
      timeZone: "America/New_York",
      downtime: nightly(23 * 60, 10 * 60),
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

    const result = placeTasks(
      tasks.map((task) => planTask(task)),
      freeTimeMap(range, fixedItems, settings),
    );

    expect(result.placements).toEqual([
      {
        taskId: "Lunch",
        ...utc("2026-10-05T16:30", "2026-10-05T17:15"),
        pinned: false,
        status: "planned",
      }, // 12:30
      {
        taskId: "Problem set",
        ...utc("2026-10-05T17:15", "2026-10-05T20:15"),
        pinned: false,
        status: "planned",
      }, // 13:15
      {
        taskId: "Essay",
        ...utc("2026-10-05T20:15", "2026-10-05T21:45"),
        pinned: false,
        status: "planned",
      }, // 16:15
    ]);
    // Most urgent, but after lunch only 4h45m is free before 18:00.
    expect(result.unplaced.map((task) => task.id)).toEqual(["Lab report"]);
  });

  it("ranks tasks by the free time they can use: stretches too short for one of their blocks don't count", () => {
    const free = mergeIntervals([iv("08:00", "08:25"), iv("08:30", "10:00")]);
    // Counting all its free time, the call would seem the less pressed and the report would take 08:30 first, but
    // 08:00–08:25 is too short for it.
    const call = flexible("Call", 30, iv("08:00", "09:00"));
    const report = flexible("Report", 60, iv("08:25", "10:00"));

    const { placements, unplaced } = placeTasks(
      [report, call].map((task) => planTask(task)),
      free,
    );

    expect(placements.map(({ taskId, start, end }) => ({ taskId, start, end }))).toEqual([
      { taskId: "Call", ...iv("08:30", "09:00") },
      { taskId: "Report", ...iv("09:00", "10:00") },
    ]);
    expect(unplaced).toEqual([]);
  });

  it("places a split task whole as chunks with breaks, or not at all", () => {
    const settings: SchedulerSettings = {
      timeZone: "UTC",
      downtime: nightly(22 * 60, 10 * 60),
    };
    const day = iv("00:00", "23:59");
    const free = freeTimeMap(day, [fixed("Seminar", iv("12:00", "13:00"))], settings);
    const tasks = [
      { ...flexible("Thesis", 150, day), split: { minChunkMin: 30, maxChunkMin: 60, breakMin: 30 } },
      // Would fit 10:00–12:00 as one block, but not as two hours with a break between.
      { ...flexible("Revision", 120, iv("10:00", "13:00")), split: { minChunkMin: 60, maxChunkMin: 60, breakMin: 30 } },
    ];

    const { placements, unplaced } = placeTasks(
      tasks.map((task) => planTask(task)),
      free,
    );

    expect(placements.map(({ taskId, start, end }) => ({ taskId, start, end }))).toEqual([
      { taskId: "Thesis", ...iv("10:00", "11:00") },
      { taskId: "Thesis", ...iv("11:30", "12:00") },
      { taskId: "Thesis", ...iv("13:00", "14:00") },
    ]);
    expect(unplaced.map((task) => task.id)).toEqual(["Revision"]);
  });

  it("follows each task's spread, falling back to the others when it finds no room", () => {
    const settings: SchedulerSettings = {
      timeZone: "UTC",
      downtime: nightly(22 * 60, 10 * 60),
    };
    const threeDays = utc("2026-10-05T00:00", "2026-10-08T00:00"); // free 10:00–22:00 each day
    const task = (id: string, durationMin: number, spread: SpreadStrategy, split: Split | null = null) => ({
      ...flexible(id, durationMin, threeDays),
      spread,
      split,
    });
    const tasks = [
      task("Essay", 60, "even"),
      task("Practice", 60, "just-in-time"),
      task("Reading", 60, "asap"),
      task("Thesis", 180, "even", { minChunkMin: 60, maxChunkMin: 60, breakMin: 30 }), // the most pressure, so placed first
    ];

    const { placements } = placeTasks(
      tasks.map((task) => planTask(task)),
      freeTimeMap(threeDays, [], settings),
    );

    expect(placements.map(({ taskId, start, end }) => ({ taskId, start, end }))).toEqual([
      // Centred in each day's free time.
      { taskId: "Thesis", ...utc("2026-10-05T15:30", "2026-10-05T16:30") },
      { taskId: "Thesis", ...utc("2026-10-06T15:30", "2026-10-06T16:30") },
      { taskId: "Thesis", ...utc("2026-10-07T15:30", "2026-10-07T16:30") },
      // Its centre is Tuesday 15:00, so it goes in the first fit from there.
      { taskId: "Essay", ...utc("2026-10-06T16:30", "2026-10-06T17:30") },
      { taskId: "Practice", ...utc("2026-10-07T21:00", "2026-10-07T22:00") },
      { taskId: "Reading", ...utc("2026-10-05T10:00", "2026-10-05T11:00") },
    ]);

    // 12 minutes left, off the grid: ending on it, the latest block would start too early, and starting on it, the
    // earliest would end too late, so each falls back to the other.
    const odd = (spread: SpreadStrategy) => planTask({ ...flexible("Rest", 12, iv("00:00", "23:59")), spread });
    expect(placeTasks([odd("just-in-time")], mergeIntervals([iv("01:09", "01:22")])).placements).toEqual([
      { taskId: "Rest", ...iv("01:10", "01:22"), pinned: false, status: "planned" },
    ]);
    expect(placeTasks([odd("asap")], mergeIntervals([iv("01:08", "01:20")])).placements).toEqual([
      { taskId: "Rest", ...iv("01:08", "01:20"), pinned: false, status: "planned" },
    ]);

    // Its centre is 10:15, and nothing fits from there on, so it goes in the earliest fit.
    const tight = mergeIntervals([iv("10:00", "11:00"), iv("11:30", "12:00")]);
    expect(
      placeTasks([planTask({ ...flexible("Call", 60, iv("00:00", "23:59")), spread: "even" })], tight).placements,
    ).toEqual([{ taskId: "Call", ...iv("10:00", "11:00"), pinned: false, status: "planned" }]);
  });

  it("places all of each task in free time inside its window, chunks apart, never overlapping, leaving out only blocks that can't fit", () => {
    const fixedItemsArb = fc.array(fixedItemArb, { maxLength: 6 });

    fc.assert(
      fc.property(
        intervalArb(SPAN_MIN),
        utcSettingsArb,
        fixedItemsArb,
        flexibleItemsArb,
        (range, settings, fixedItems, tasks) => {
          const free = freeTimeMap(range, fixedItems, settings);
          const { placements, unplaced } = placeTasks(
            tasks.map((task) => planTask(task)),
            free,
          );
          const tasksById = new Map(tasks.map((task) => [task.id, task]));

          const placedIds = new Set(placements.map((p) => p.taskId));
          const outcomeIds = [...placedIds, ...unplaced.map((task) => task.id)];
          expect(outcomeIds.toSorted()).toEqual([...tasksById.keys()].toSorted());

          for (const id of placedIds) {
            const task = tasksById.get(id)!;
            const chunks = placements.filter((p) => p.taskId === id);
            expect(chunks.reduce((sum, p) => sum + minutesBetween(p.start, p.end), 0)).toBe(task.durationMin);
            if (!task.split) expect(chunks).toHaveLength(1);
            for (const [i, chunk] of chunks.entries()) {
              expect(chunk.start >= task.earliestStart && chunk.end <= task.deadline).toBe(true);
              expect(inRequiredHours(task, chunk)).toBe(true);
              expect(subtractIntervals([chunk], free)).toEqual([]);
              if (i > 0) {
                expect(minutesBetween(chunks[i - 1].end, chunk.start)).toBeGreaterThanOrEqual(task.split!.breakMin);
              }
            }
          }

          const byStart = placements.toSorted((a, b) => a.start.getTime() - b.start.getTime());
          for (let i = 1; i < byStart.length; i++) {
            expect(byStart[i - 1].end <= byStart[i].start).toBe(true);
          }

          // Only for single blocks: a greedy chunk search can miss chunks that would fit.
          const leftover = subtractIntervals(free, placements);
          for (const task of unplaced.filter((task) => !task.split)) {
            expect(
              findEarliestSlot(intersectIntervals(leftover, requiredTime(task)), task.durationMin, {
                start: task.earliestStart,
                end: task.deadline,
              }),
            ).toBeNull();
          }
        },
      ),
    );
  });
});
