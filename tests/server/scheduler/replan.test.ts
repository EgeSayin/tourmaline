import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { minutesBetween } from "@/lib/duration";
import type { FlexibleItem } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import type { SchedulerSettings } from "@/lib/settings";
import { freeTimeMap } from "@/server/scheduler/free-time";
import { subtractIntervals } from "@/server/scheduler/intervals";
import { replan } from "@/server/scheduler/replan";
import { findEarliestSlot } from "@/server/scheduler/slots";
import { intervalArb, SPAN_MIN, utc } from "../../support/intervals";
import { fixed, fixedItemArb, flexible, flexibleItemsArb } from "../../support/items";
import { utcSettingsArb } from "../../support/settings";

const scenarioArb = fc
  .tuple(
    intervalArb(SPAN_MIN), // starts now
    utcSettingsArb,
    fc.array(fixedItemArb, { maxLength: 4 }),
    flexibleItemsArb,
  )
  .map(([horizon, settings, fixedItems, tasks]) => ({ horizon, settings, fixedItems, tasks }));

/** Saved placements from an earlier run: random times, some pinned, marked `manual` to tell them from new ones. */
function existingArb(tasks: FlexibleItem[]): fc.Arbitrary<Placement[]> {
  if (tasks.length === 0) return fc.constant([]);
  return fc.array(
    fc
      .tuple(fc.integer({ min: 0, max: tasks.length - 1 }), intervalArb(120), fc.boolean())
      .map(([i, times, pinned]): Placement => ({ itemId: tasks[i].id, ...times, source: "manual", pinned })),
    { maxLength: 6 },
  );
}

const samePlacement = (a: Placement, b: Placement) =>
  a.itemId === b.itemId && a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();

const minutesFor = (placements: Placement[], itemId: string) =>
  placements.filter((p) => p.itemId === itemId).reduce((sum, p) => sum + minutesBetween(p.start, p.end), 0);

describe("replan", { tags: ["unit", "critical"] }, () => {
  it("keeps started, pinned, and still-valid placements and places the remaining time from now", () => {
    const settings: SchedulerSettings = { timeZone: "UTC", downtime: { startMinute: 23 * 60, endMinute: 10 * 60 } };
    const horizon = utc("2026-10-05T15:00", "2026-10-07T00:00"); // Mon 15:00 to the end of Tue
    const window = utc("2026-10-05T00:00", "2026-10-06T23:00");
    const lecture = fixed("Lecture", utc("2026-10-05T16:00", "2026-10-05T17:00"));
    const tasks = [
      flexible("Essay", 120, window),
      flexible("Reading", 60, window),
      flexible("Homework", 90, window),
      flexible("Call prep", 60, window),
    ];
    const placement = (itemId: string, times: { start: Date; end: Date }, pinned = false): Placement => ({
      itemId,
      ...times,
      source: "auto",
      pinned,
    });

    const pastEssay = placement("Essay", utc("2026-10-05T10:00", "2026-10-05T11:00"));
    const inProgress = placement("Call prep", utc("2026-10-05T14:30", "2026-10-05T15:30"));
    const pinnedReading = placement("Reading", utc("2026-10-06T12:00", "2026-10-06T13:00"), true);
    const futureHomework = placement("Homework", utc("2026-10-06T10:00", "2026-10-06T11:30"));

    const result = replan({
      horizon,
      fixedItems: [lecture],
      flexibleItems: tasks,
      existing: [futureHomework, pinnedReading, inProgress, pastEssay],
      settings,
    });

    expect(result.placements).toEqual([
      pastEssay,
      inProgress,
      placement("Essay", utc("2026-10-05T17:00", "2026-10-05T18:00")), // the remaining hour, after the lecture
      futureHomework, // still valid, so it stays
      pinnedReading,
    ]);
    expect(result.unplaced).toEqual([]);
  });

  it("moves existing placements when a task can't fit around them", () => {
    // Free only 10:00–14:00.
    const settings: SchedulerSettings = { timeZone: "UTC", downtime: { startMinute: 14 * 60, endMinute: 10 * 60 } };
    const day = utc("2026-10-05T00:00", "2026-10-06T00:00");
    const reading = flexible("Reading", 60, day);
    const examPrep = flexible("Exam prep", 180, utc("2026-10-05T00:00", "2026-10-05T14:00"));
    const existingReading: Placement = {
      itemId: "Reading",
      ...utc("2026-10-05T11:00", "2026-10-05T12:00"),
      source: "auto",
      pinned: false,
    };

    const result = replan({
      horizon: utc("2026-10-05T08:00", "2026-10-06T00:00"),
      fixedItems: [],
      flexibleItems: [reading, examPrep],
      existing: [existingReading],
      settings,
    });

    expect(result.placements).toEqual([
      { itemId: "Exam prep", ...utc("2026-10-05T10:00", "2026-10-05T13:00"), source: "auto", pinned: false },
      { itemId: "Reading", ...utc("2026-10-05T13:00", "2026-10-05T14:00"), source: "auto", pinned: false },
    ]);
    expect(result.unplaced).toEqual([]);
  });

  it(
    "keeps started and pinned placements and fills each task's remaining time after now",
    { tags: ["property"] },
    () => {
      const caseArb = scenarioArb.chain((scenario) => fc.tuple(fc.constant(scenario), existingArb(scenario.tasks)));

      fc.assert(
        fc.property(caseArb, ([{ horizon, settings, fixedItems, tasks }, existing]) => {
          const result = replan({ horizon, fixedItems, flexibleItems: tasks, existing, settings });
          const kept = existing.filter((p) => p.pinned || p.start < horizon.start);
          const others = result.placements.filter((p) => !kept.some((k) => samePlacement(k, p)));

          for (const placement of kept) expect(result.placements).toContainEqual(placement);
          for (const placement of others) {
            expect(placement.source === "auto" || existing.some((e) => samePlacement(e, placement))).toBe(true);
          }

          const free = freeTimeMap(horizon, fixedItems, settings);
          const byStart = [...others].sort((a, b) => a.start.getTime() - b.start.getTime());
          for (const [i, placement] of byStart.entries()) {
            const task = tasks.find((t) => t.id === placement.itemId)!;
            expect(placement.start >= task.earliestStart && placement.end <= task.deadline).toBe(true);
            expect(subtractIntervals([placement], subtractIntervals(free, kept))).toEqual([]);
            if (i > 0) expect(byStart[i - 1].end <= placement.start).toBe(true);
          }

          const leftover = subtractIntervals(free, [...kept, ...others]);
          for (const task of tasks) {
            const remaining = task.durationMin - minutesFor(kept, task.id);
            const placedMin = minutesFor(others, task.id);
            const unplaced = result.unplaced.find((t) => t.id === task.id);

            if (remaining <= 0) {
              expect(placedMin).toBe(0);
              expect(unplaced).toBeUndefined();
            } else if (unplaced) {
              expect(placedMin).toBe(0);
              expect(unplaced.durationMin).toBe(remaining);
              expect(
                findEarliestSlot(leftover, remaining, { start: task.earliestStart, end: task.deadline }),
              ).toBeNull();
            } else {
              expect(placedMin).toBe(remaining);
            }
          }
        }),
      );
    },
  );

  it("changes nothing when an unchanged plan is planned again", { tags: ["property"] }, () => {
    fc.assert(
      fc.property(scenarioArb, ({ horizon, settings, fixedItems, tasks }) => {
        const input = { horizon, fixedItems, flexibleItems: tasks, settings };
        const first = replan({ ...input, existing: [] });

        expect(replan({ ...input, existing: first.placements })).toEqual(first);
      }),
    );
  });

  it("doesn't move existing placements to fit a new task that fits around them", { tags: ["property"] }, () => {
    const newTaskArb = fc
      .tuple(fc.integer({ min: 1, max: 4 * 60 }), intervalArb(SPAN_MIN))
      .map(([durationMin, window]) => flexible("New task", durationMin, window));

    fc.assert(
      fc.property(scenarioArb, newTaskArb, ({ horizon, settings, fixedItems, tasks }, newTask) => {
        const input = { horizon, fixedItems, settings };
        const before = replan({ ...input, flexibleItems: tasks, existing: [] });

        const free = freeTimeMap(horizon, fixedItems, settings);
        const gaps = subtractIntervals(free, before.placements);
        const window = {
          start: newTask.earliestStart > horizon.start ? newTask.earliestStart : horizon.start,
          end: newTask.deadline,
        };
        fc.pre(before.unplaced.length === 0 && findEarliestSlot(gaps, newTask.durationMin, window) !== null);

        const after = replan({ ...input, flexibleItems: [...tasks, newTask], existing: before.placements });

        for (const placement of before.placements) expect(after.placements).toContainEqual(placement);
        expect(after.unplaced).toEqual([]);
      }),
    );
  });
});
