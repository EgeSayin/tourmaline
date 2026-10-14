import { nightly } from "@/lib/downtime";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { minutesBetween } from "@/lib/time/duration";
import type { Task } from "@/lib/items";
import { isPending, PLACEMENT_STATUSES, type Placement } from "@/lib/placements";
import { CHUNK_BREAK_MIN, type SchedulerSettings, NO_FOCUS_CAPS } from "@/lib/settings";
import { freeTimeMap } from "@/server/scheduler/free-time";
import { subtractIntervals } from "@/lib/time/interval";
import { replan } from "@/server/scheduler/replan";
import { findEarliestSlot } from "@/server/scheduler/search";
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

/** Saved placements: random times and statuses, some pinned. */
function existingArb(tasks: Task[]): fc.Arbitrary<Placement[]> {
  if (tasks.length === 0) return fc.constant([]);
  return fc.array(
    fc
      .tuple(
        fc.integer({ min: 0, max: tasks.length - 1 }),
        intervalArb(120),
        fc.boolean(),
        fc.constantFrom(...PLACEMENT_STATUSES),
      )
      .map(([i, times, pinned, status]): Placement => ({
        taskId: tasks[i].id,
        ...times,
        pinned,
        status,
      })),
    { maxLength: 6 },
  );
}

const samePlacement = (a: Placement, b: Placement) =>
  a.taskId === b.taskId && a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();

const minutesFor = (placements: Placement[], taskId: string) =>
  placements.filter((p) => p.taskId === taskId).reduce((sum, p) => sum + minutesBetween(p.start, p.end), 0);

describe("replan", () => {
  it("keeps done, pinned, in-progress, unreviewed and still-valid placements, and places the rest from now", () => {
    const settings: SchedulerSettings = {
      timeZone: "UTC",
      downtime: nightly(23 * 60, 10 * 60),
      focusCaps: NO_FOCUS_CAPS,
    };
    const horizon = utc("2026-10-05T15:00", "2026-10-07T00:00"); // Mon 15:00 to the end of Tue
    const window = utc("2026-10-05T00:00", "2026-10-06T23:00");
    const lecture = fixed("Lecture", utc("2026-10-05T16:00", "2026-10-05T17:00"));
    const tasks = [
      flexible("Essay", 120, window),
      flexible("Reading", 60, window),
      flexible("Homework", 90, window),
      flexible("Call prep", 60, window),
      flexible("Review", 60, window),
      flexible("Notes", 30, window),
    ];
    const placement = (
      taskId: string,
      times: { start: Date; end: Date },
      extra: Partial<Placement> = {},
    ): Placement => ({
      taskId,
      ...times,
      pinned: false,
      status: "planned",
      ...extra,
    });

    const pastEssay = placement("Essay", utc("2026-10-05T10:00", "2026-10-05T11:00"), { status: "done" });
    const missedReview = placement("Review", utc("2026-10-05T11:00", "2026-10-05T12:00"), { status: "missed" });
    const unreviewedNotes = placement("Notes", utc("2026-10-05T12:00", "2026-10-05T12:30"));
    const inProgress = placement("Call prep", utc("2026-10-05T14:30", "2026-10-05T15:30"));
    const pinnedReading = placement("Reading", utc("2026-10-06T12:00", "2026-10-06T13:00"), { pinned: true });
    const futureHomework = placement("Homework", utc("2026-10-06T10:00", "2026-10-06T11:30"));

    const result = replan({
      horizon,
      fixedItems: [lecture],
      tasks,
      existing: [futureHomework, pinnedReading, inProgress, missedReview, unreviewedNotes, pastEssay],
      settings,
    });

    expect(result.placements).toEqual([
      pastEssay,
      unreviewedNotes, // counts until it's reviewed
      inProgress,
      placement("Essay", utc("2026-10-05T17:00", "2026-10-05T18:00")), // the remaining hour, after the lecture
      placement("Review", utc("2026-10-05T18:00", "2026-10-05T19:00")), // missed, so placed again
      futureHomework, // still valid, so it stays
      pinnedReading,
    ]);
    expect(result.unplaced).toEqual([]);
  });

  it("moves existing placements when a task can't fit around them", () => {
    // Free only 10:00–14:00.
    const settings: SchedulerSettings = {
      timeZone: "UTC",
      downtime: nightly(14 * 60, 10 * 60),
      focusCaps: NO_FOCUS_CAPS,
    };
    const day = utc("2026-10-05T00:00", "2026-10-06T00:00");
    const reading = flexible("Reading", 60, day);
    const examPrep = flexible("Exam prep", 180, utc("2026-10-05T00:00", "2026-10-05T14:00"));
    const existingReading: Placement = {
      taskId: "Reading",
      ...utc("2026-10-05T11:00", "2026-10-05T12:00"),
      pinned: false,
      status: "planned",
    };

    const result = replan({
      horizon: utc("2026-10-05T08:00", "2026-10-06T00:00"),
      fixedItems: [],
      tasks: [reading, examPrep],
      existing: [existingReading],
      settings,
    });

    expect(result.placements).toEqual([
      {
        taskId: "Exam prep",
        ...utc("2026-10-05T10:00", "2026-10-05T13:00"),
        pinned: false,
        status: "planned",
      },
      {
        taskId: "Reading",
        ...utc("2026-10-05T13:00", "2026-10-05T14:00"),
        pinned: false,
        status: "planned",
      },
    ]);
    expect(result.unplaced).toEqual([]);
  });

  it("bumps less important tasks for a mandatory one, planning them again where they still fit", () => {
    // Free only 10:00–14:00, filled with an essay and some reading before the exam prep comes in.
    const settings: SchedulerSettings = {
      timeZone: "UTC",
      downtime: nightly(14 * 60, 10 * 60),
      focusCaps: NO_FOCUS_CAPS,
    };
    const day = utc("2026-10-05T00:00", "2026-10-06T00:00");
    const essay = flexible("Essay", 120, day);
    const reading = flexible("Reading", 60, day, "low");
    const examPrep = flexible("Exam prep", 180, utc("2026-10-05T00:00", "2026-10-05T13:00"), "mandatory");
    const planned = (taskId: string, times: { start: Date; end: Date }): Placement => ({
      taskId,
      ...times,
      pinned: false,
      status: "planned",
    });

    const result = replan({
      horizon: utc("2026-10-05T08:00", "2026-10-06T00:00"),
      fixedItems: [],
      tasks: [essay, reading, examPrep],
      existing: [
        planned("Essay", utc("2026-10-05T10:00", "2026-10-05T12:00")),
        planned("Reading", utc("2026-10-05T12:00", "2026-10-05T13:00")),
      ],
      settings,
    });

    expect(result.placements).toEqual([
      planned("Exam prep", utc("2026-10-05T10:00", "2026-10-05T13:00")),
      planned("Reading", utc("2026-10-05T13:00", "2026-10-05T14:00")),
    ]);
    expect(result.unplaced.map((task) => task.title)).toEqual(["Essay"]); // no two hours left

    // A task that can't fit even with everything else bumped moves nothing.
    const marathon = flexible("Marathon", 5 * 60, day, "mandatory");
    const again = replan({
      horizon: utc("2026-10-05T08:00", "2026-10-06T00:00"),
      fixedItems: [],
      tasks: [reading, marathon],
      existing: [planned("Reading", utc("2026-10-05T12:00", "2026-10-05T13:00"))],
      settings,
    });
    expect(again.placements).toEqual([planned("Reading", utc("2026-10-05T12:00", "2026-10-05T13:00"))]);
    expect(again.unplaced.map((task) => task.title)).toEqual(["Marathon"]);
  });

  it("moves less important blocks before going over a focus cap, and goes over it before leaving a task out", () => {
    // Free 10:00–14:00 each day; Monday's cap is an hour, Tuesday's two.
    const settings = (tuesdayCapMin: number): SchedulerSettings => ({
      timeZone: "UTC",
      downtime: nightly(14 * 60, 10 * 60),
      focusCaps: [60, tuesdayCapMin, ...NO_FOCUS_CAPS.slice(2)],
    });
    const planned = (taskId: string, times: { start: Date; end: Date }): Placement => ({
      taskId,
      ...times,
      pinned: false,
      status: "planned",
    });
    const reading = flexible("Reading", 60, utc("2026-10-05T00:00", "2026-10-07T00:00"), "low");
    const examPrep = flexible("Exam prep", 60, utc("2026-10-05T00:00", "2026-10-06T00:00"), "mandatory");
    const plan = (tuesdayCapMin: number) =>
      replan({
        horizon: utc("2026-10-05T08:00", "2026-10-07T00:00"),
        fixedItems: [],
        tasks: [reading, examPrep],
        existing: [planned("Reading", utc("2026-10-05T10:00", "2026-10-05T11:00"))],
        settings: settings(tuesdayCapMin),
      });

    // Monday is full with the reading, which can move to Tuesday.
    expect(plan(120)).toEqual({
      placements: [
        planned("Exam prep", utc("2026-10-05T10:00", "2026-10-05T11:00")),
        planned("Reading", utc("2026-10-06T10:00", "2026-10-06T11:00")),
      ],
      unplaced: [],
    });
    // With no room on Tuesday either, moving it gains nothing, so the exam prep goes over Monday's cap.
    expect(plan(0)).toEqual({
      placements: [
        planned("Reading", utc("2026-10-05T10:00", "2026-10-05T11:00")),
        planned("Exam prep", utc("2026-10-05T11:00", "2026-10-05T12:00")),
      ],
      unplaced: [],
    });
  });

  it("places a task in the time another of its level took first, when another order fits both", () => {
    const settings: SchedulerSettings = { timeZone: "UTC", downtime: Array(7).fill([]), focusCaps: NO_FOCUS_CAPS };
    // Free 08:30–09:30, 10:30–11:20 and 12:15–13:00.
    const fixedItems = [
      fixed("Breakfast", utc("2026-10-05T08:00", "2026-10-05T08:30")),
      fixed("Meeting", utc("2026-10-05T09:30", "2026-10-05T10:30")),
      fixed("Lunch", utc("2026-10-05T11:20", "2026-10-05T12:15")),
      fixed("Call", utc("2026-10-05T13:00", "2026-10-05T13:15")),
    ];
    // The project needs almost all of it, so its pressure is the higher, and placed first it takes 08:30–09:25.
    const project = {
      ...flexible("Project", 145, utc("2026-10-05T08:00", "2026-10-05T13:15"), "mandatory"),
      split: { minChunkMin: 45, maxChunkMin: 60 },
    };
    const email = flexible("Email", 5, utc("2026-10-05T08:00", "2026-10-05T09:00"), "mandatory");
    const planned = (taskId: string, times: { start: Date; end: Date }): Placement => ({
      taskId,
      ...times,
      pinned: false,
      status: "planned",
    });

    const result = replan({
      horizon: utc("2026-10-05T08:00", "2026-10-05T13:15"),
      fixedItems,
      tasks: [project, email],
      existing: [],
      settings,
    });

    expect(result.placements).toEqual([
      planned("Email", utc("2026-10-05T08:30", "2026-10-05T08:35")),
      planned("Project", utc("2026-10-05T08:35", "2026-10-05T09:30")),
      planned("Project", utc("2026-10-05T10:30", "2026-10-05T11:15")),
      planned("Project", utc("2026-10-05T12:15", "2026-10-05T13:00")),
    ]);
    expect(result.unplaced).toEqual([]);
  });

  it("places a task that fits nowhere else over an optional fixed item of lower priority, and only then", () => {
    const settings: SchedulerSettings = { timeZone: "UTC", downtime: Array(7).fill([]), focusCaps: NO_FOCUS_CAPS };
    const day = (from: string, to: string) => utc(`2026-10-05T${from}`, `2026-10-05T${to}`);
    // Free only 12:00–13:00.
    const fixedItems = [
      { ...fixed("Club", day("10:00", "11:00")), priority: "normal" as const },
      fixed("Exam", day("11:00", "12:00")),
    ];
    const tasks = [
      flexible("Report", 60, day("10:00", "12:00"), "high"), // fits only over the club
      flexible("Notes", 30, day("10:00", "13:00"), "high"), // fits after the exam
      flexible("Chat", 30, day("10:00", "11:00")), // no more important than the club
      flexible("Revision", 60, day("11:00", "12:00"), "mandatory"), // the exam is mandatory
    ];
    const planned = (taskId: string, times: { start: Date; end: Date }): Placement => ({
      taskId,
      ...times,
      pinned: false,
      status: "planned",
    });

    const input = { horizon: day("10:00", "13:00"), fixedItems, tasks, settings };
    const result = replan({ ...input, existing: [] });

    expect(result.placements).toEqual([
      planned("Report", day("10:00", "11:00")),
      planned("Notes", day("12:00", "12:30")),
    ]);
    expect(result.unplaced.map((task) => task.id)).toEqual(["Chat", "Revision"]);
    expect(replan({ ...input, existing: result.placements })).toEqual(result); // decided the same way again
  });

  it("keeps a break between a split task's new chunks and its earlier ones", () => {
    const settings: SchedulerSettings = {
      timeZone: "UTC",
      downtime: nightly(22 * 60, 10 * 60),
      focusCaps: NO_FOCUS_CAPS,
    };
    const thesis = {
      ...flexible("Thesis", 90, utc("2026-10-05T10:00", "2026-10-05T22:00")),
      split: { minChunkMin: 30, maxChunkMin: 45 },
    };
    const done: Placement = {
      taskId: "Thesis",
      ...utc("2026-10-05T10:00", "2026-10-05T10:45"),
      pinned: false,
      status: "done",
    };

    const result = replan({
      horizon: utc("2026-10-05T11:00", "2026-10-06T00:00"),
      fixedItems: [],
      tasks: [thesis],
      existing: [done],
      settings,
    });

    expect(result.placements).toEqual([
      done,
      {
        taskId: "Thesis",
        ...utc("2026-10-05T11:15", "2026-10-05T12:00"),
        pinned: false,
        status: "planned",
      },
    ]);
  });

  it("keeps done, pinned and in-progress placements, drops missed ones, and fills each task's remaining time after now", () => {
    const caseArb = scenarioArb.chain((scenario) => fc.tuple(fc.constant(scenario), existingArb(scenario.tasks)));

    fc.assert(
      fc.property(caseArb, ([{ horizon, settings, fixedItems, tasks }, existing]) => {
        const result = replan({ horizon, fixedItems, tasks, existing, settings });
        const now = horizon.start;
        const kept = existing.filter(
          (p) => p.status === "done" || (p.status === "planned" && (p.pinned || p.start < now)),
        );
        const missed = existing.filter((p) => p.status === "missed");
        for (const placement of missed) expect(result.placements).not.toContainEqual(placement);
        const others = result.placements.filter((p) => !kept.some((k) => samePlacement(k, p)));

        for (const placement of kept) expect(result.placements).toContainEqual(placement);

        const free = freeTimeMap(horizon, fixedItems, settings);
        const byStart = [...others].sort((a, b) => a.start.getTime() - b.start.getTime());
        for (const [i, placement] of byStart.entries()) {
          const task = tasks.find((t) => t.id === placement.taskId)!;
          expect(placement.start >= task.earliestStart && placement.end <= task.deadline).toBe(true);
          expect(subtractIntervals([placement], subtractIntervals(free, kept))).toEqual([]);
          if (i > 0) expect(byStart[i - 1].end <= placement.start).toBe(true);
        }

        const split = new Set(tasks.filter((task) => task.split).map((task) => task.id));
        for (const placement of others.filter(
          (p) => !existing.some((e) => samePlacement(e, p)) && split.has(p.taskId),
        )) {
          for (const other of result.placements.filter((p) => p.taskId === placement.taskId && p !== placement)) {
            const apart = Math.max(
              minutesBetween(other.end, placement.start),
              minutesBetween(placement.end, other.start),
            );
            expect(apart).toBeGreaterThanOrEqual(CHUNK_BREAK_MIN);
          }
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
            // Saved blocks that still fit stay; what's left of the task waits in the queue.
            expect(placedMin + unplaced.durationMin).toBe(remaining);
            // Only for single blocks: a greedy chunk search can miss chunks that would fit.
            if (!task.split) {
              expect(
                findEarliestSlot(leftover, remaining, { start: task.earliestStart, end: task.deadline }),
              ).toBeNull();
            }
          } else {
            expect(placedMin).toBe(remaining);
          }
        }
      }),
    );
  });

  it("changes nothing when an unchanged plan is planned again", () => {
    fc.assert(
      fc.property(scenarioArb, ({ horizon, settings, fixedItems, tasks }) => {
        const input = { horizon, fixedItems, tasks, settings };
        const first = replan({ ...input, existing: [] });

        expect(replan({ ...input, existing: first.placements })).toEqual(first);
      }),
    );
  });

  it("bumps its own plan's blocks too, so planning that plan again finds nothing better", () => {
    // Two high tasks of almost the same pressure: placed in that order, the long-block one doesn't fit.
    const day = (start: string, end: string) => utc(`2026-10-05T${start}`, `2026-10-05T${end}`);
    const settings: SchedulerSettings = {
      timeZone: "UTC",
      downtime: [
        [
          { startMinute: 18 * 60, endMinute: 18 * 60 + 30 },
          { startMinute: 20 * 60, endMinute: 20 * 60 + 30 },
        ],
        [],
        [],
        [],
        [],
        [],
        [],
      ],
      focusCaps: NO_FOCUS_CAPS,
    };
    const tasks: Task[] = [
      { ...flexible("Short blocks", 155, day("13:39", "19:30"), "high"), split: { minChunkMin: 5, maxChunkMin: 25 } },
      { ...flexible("Errand", 5, day("00:00", "12:00"), "mandatory"), spread: "just-in-time" },
      { ...flexible("Long blocks", 210, day("07:56", "15:11"), "high"), split: { minChunkMin: 95, maxChunkMin: 105 } },
    ];
    const input = { horizon: day("00:00", "19:30"), settings, fixedItems: [], tasks };

    const first = replan({ ...input, existing: [] });
    expect(first.unplaced).toEqual([]);
    expect(replan({ ...input, existing: first.placements })).toEqual(first);
  });

  it("doesn't move existing placements to fit a new task that fits around them", () => {
    const newTaskArb = fc
      .tuple(fc.integer({ min: 1, max: 4 * 60 }), intervalArb(SPAN_MIN))
      .map(([durationMin, window]) => flexible("New task", durationMin, window));

    fc.assert(
      fc.property(scenarioArb, newTaskArb, ({ horizon, settings, fixedItems, tasks }, newTask) => {
        const input = { horizon, fixedItems, settings };
        const before = replan({ ...input, tasks, existing: [] });

        const free = freeTimeMap(horizon, fixedItems, settings);
        const gaps = subtractIntervals(free, before.placements);
        const window = {
          start: newTask.earliestStart > horizon.start ? newTask.earliestStart : horizon.start,
          end: newTask.deadline,
        };
        fc.pre(before.unplaced.length === 0 && findEarliestSlot(gaps, newTask.durationMin, window) !== null);

        const after = replan({ ...input, tasks: [...tasks, newTask], existing: before.placements });

        for (const placement of before.placements) expect(after.placements).toContainEqual(placement);
        expect(after.unplaced).toEqual([]);
      }),
    );
  }, 30_000); // it discards every scenario that leaves a task unplaced, so it plans many

  it("never leaves a mandatory task unplaced for lower-priority ones: their pending blocks give way", () => {
    const withExistingArb = scenarioArb.chain((scenario) =>
      existingArb(scenario.tasks).map((existing) => ({ ...scenario, existing })),
    );
    fc.assert(
      fc.property(withExistingArb, ({ horizon, settings, fixedItems, tasks, existing }) => {
        const mandatory = new Set(tasks.filter((task) => task.priority === "mandatory").map((task) => task.id));
        const unplacedMandatory = ({ unplaced }: { unplaced: Task[] }) =>
          unplaced
            .map((task) => task.id)
            .filter((id) => mandatory.has(id))
            .sort();

        const all = replan({ horizon, settings, fixedItems, tasks, existing });
        const withoutLower = replan({
          horizon,
          settings,
          fixedItems,
          tasks: tasks.filter((task) => mandatory.has(task.id)),
          existing: existing.filter((p) => mandatory.has(p.taskId) || !isPending(p, horizon.start)),
        });

        expect(unplacedMandatory(all).length).toBeLessThanOrEqual(unplacedMandatory(withoutLower).length);
        const unplacedIds = new Set(all.unplaced.map((task) => task.id));
        expect(all.unplaced.map((task) => task.id)).toEqual(
          tasks.filter((task) => unplacedIds.has(task.id)).map((task) => task.id),
        );
      }),
    );
  });
});
