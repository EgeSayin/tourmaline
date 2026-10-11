import { describe, expect } from "vitest";
import type { Placement } from "@/lib/placements";
import { occurrenceId } from "@/lib/recurrence";
import { deleteItem, insertItem } from "@/server/db/items-repository";
import {
  deletePlacements,
  insertPlacements,
  loadPlacement,
  loadPlacements,
  loadTaskPlacements,
  replacePendingPlacements,
  updatePlacement,
} from "@/server/db/placements-repository";
import { dbTest as it } from "../../support/database";
import { fixed, flexible } from "../../support/items";
import { utc } from "../../support/intervals";

const week = utc("2026-10-05T04:00", "2026-10-12T04:00");

describe("placements repository", () => {
  it("loads the placements overlapping a range, sorted by start", async ({ tx }) => {
    const essayId = await insertItem(tx, flexible("Essay", 120, week));
    const placement = (start: string, end: string, extra: Partial<Placement> = {}): Placement => ({
      taskId: essayId,
      ...utc(start, end),
      pinned: false,
      status: "planned",
      ...extra,
    });

    const wednesday = placement("2026-10-07T14:00", "2026-10-07T15:00", { pinned: true });
    const monday = placement("2026-10-05T14:00", "2026-10-05T15:00", { status: "done" });
    const acrossWeekStart = placement("2026-10-05T03:00", "2026-10-05T05:00", { status: "missed" });
    const nextWeek = placement("2026-10-12T14:00", "2026-10-12T15:00");
    await insertPlacements(tx, [wednesday, nextWeek, monday, acrossWeekStart]);

    expect(await loadPlacements(tx, week)).toEqual([acrossWeekStart, monday, wednesday]);
  });

  it("keeps track of which occurrence of a recurring task each placement is for, and finds each by it, alone or by task", async ({
    tx,
  }) => {
    const essayId = await insertItem(tx, flexible("Essay", 60, week));
    const gymId = await insertItem(tx, {
      ...flexible("Gym", 60, utc("2026-10-05T04:00", "2026-10-06T04:00")),
      recurrence: { frequency: "daily", interval: 1, until: null },
    });
    const placement = (taskId: string, start: string, end: string): Placement => ({
      taskId,
      ...utc(start, end),
      pinned: false,
      status: "planned",
    });

    const placed = [
      placement(occurrenceId(gymId, "2026-10-05"), "2026-10-05T14:00", "2026-10-05T15:00"),
      placement(essayId, "2026-10-05T16:00", "2026-10-05T17:00"),
      placement(occurrenceId(gymId, "2026-10-06"), "2026-10-06T14:00", "2026-10-06T15:00"),
    ];
    await insertPlacements(tx, placed);

    expect(await loadPlacements(tx, week)).toEqual(placed);
    const [mondayGym, essay, tuesdayGym] = placed;
    expect(await loadTaskPlacements(tx, essayId)).toEqual([essay]);
    expect(await loadTaskPlacements(tx, mondayGym.taskId)).toEqual([mondayGym]);
    expect(await loadTaskPlacements(tx, gymId)).toEqual([]);

    // One placement, found and updated by its occurrence and start.
    await updatePlacement(tx, tuesdayGym, { status: "done", pinned: true });
    expect(await loadPlacement(tx, tuesdayGym)).toEqual({ ...tuesdayGym, status: "done", pinned: true });
    expect(await loadPlacement(tx, essay)).toEqual(essay);
    expect(await loadPlacement(tx, { ...tuesdayGym, taskId: occurrenceId(gymId, "2026-10-05") })).toBeUndefined();
    expect(await loadPlacement(tx, { ...essay, taskId: gymId })).toBeUndefined();
  });

  it("deletes a task's placements, or only its pending ones from a time", async ({ tx }) => {
    const essayId = await insertItem(tx, flexible("Essay", 240, week));
    const otherId = await insertItem(tx, flexible("Other", 60, week));
    const placement = (taskId: string, start: string, end: string, pinned = false): Placement => ({
      taskId,
      ...utc(start, end),
      pinned,
      status: "planned",
    });
    const started = placement(essayId, "2026-10-07T11:00", "2026-10-07T13:00");
    const pinned = placement(essayId, "2026-10-08T14:00", "2026-10-08T15:00", true);
    const pending = placement(essayId, "2026-10-08T16:00", "2026-10-08T17:00");
    const other = placement(otherId, "2026-10-09T16:00", "2026-10-09T17:00");
    await insertPlacements(tx, [started, pinned, pending, other]);

    await deletePlacements(tx, essayId, new Date("2026-10-07T12:00Z"));
    expect(await loadPlacements(tx, week)).toEqual([started, pinned, other]);
    await deletePlacements(tx, essayId);
    expect(await loadPlacements(tx, week)).toEqual([other]);
  });

  it("only allows placements for flexible tasks, one per start, and removes them with their task", async ({ tx }) => {
    const lectureId = await insertItem(tx, fixed("Lecture", utc("2026-10-05T14:00", "2026-10-05T15:00")));
    const essayId = await insertItem(tx, flexible("Essay", 60, week));
    const slot = {
      ...utc("2026-10-06T14:00", "2026-10-06T15:00"),
      pinned: false,
      status: "planned" as const,
    };

    await expect(
      tx.transaction((nested) => insertPlacements(nested, [{ taskId: lectureId, ...slot }])),
    ).rejects.toThrow();

    await insertPlacements(tx, [{ taskId: essayId, ...slot }]);
    await expect(
      tx.transaction((nested) => insertPlacements(nested, [{ taskId: essayId, ...slot }])),
    ).rejects.toThrow(); // one per task and start
    await deleteItem(tx, essayId);
    expect(await loadPlacements(tx, week)).toEqual([]);
  });

  it("replaces the pending placements from a time on, keeping started, pinned and done ones", async ({ tx }) => {
    const essayId = await insertItem(tx, flexible("Essay", 600, utc("2026-10-05T04:00", "2026-10-19T04:00")));
    const placement = (start: string, end: string, extra: Partial<Placement> = {}): Placement => ({
      taskId: essayId,
      ...utc(start, end),
      pinned: false,
      status: "planned",
      ...extra,
    });
    const now = new Date("2026-10-07T12:00Z");

    const started = placement("2026-10-07T11:30", "2026-10-07T12:30");
    const pinned = placement("2026-10-08T14:00", "2026-10-08T15:00", { pinned: true });
    const doneEarly = placement("2026-10-08T16:00", "2026-10-08T17:00", { status: "done" });
    const stale = placement("2026-10-09T14:00", "2026-10-09T15:00");
    const staleNextWeek = placement("2026-10-13T14:00", "2026-10-13T15:00");
    await insertPlacements(tx, [started, pinned, doneEarly, stale, staleNextWeek]);

    const replacement = placement("2026-10-10T14:00", "2026-10-10T15:00");
    await replacePendingPlacements(tx, now, [started, pinned, doneEarly, replacement]);

    expect(await loadPlacements(tx, utc("2026-10-05T04:00", "2026-10-19T04:00"))).toEqual([
      started,
      pinned,
      doneEarly,
      replacement,
    ]);
  });
});
