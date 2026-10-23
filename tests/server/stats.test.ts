import { describe, expect } from "vitest";
import type { Placement, PlacementStatus } from "@/lib/placements";
import { insertCategory } from "@/server/db/categories-repository";
import { insertItem } from "@/server/db/items-repository";
import { insertPlacements } from "@/server/db/placements-repository";
import { loadStats } from "@/server/stats";
import { dbTest as it } from "../support/database";
import { utc } from "../support/intervals";
import { flexible, unsaved } from "../support/items";

// Wed Oct 7, 2026, 16:00; the workspace keeps UTC.
const now = new Date("2026-10-07T16:00Z");

describe("stats", () => {
  it("counts each ended block in the week it started, by what became of it, and done time by category", async ({
    tx,
  }) => {
    const calculus = await insertCategory(tx, { name: "Calculus", color: "#f97316" });
    const essay = await insertItem(tx, {
      ...unsaved(flexible("Essay", 600, utc("2026-09-01T00:00", "2026-10-30T00:00"))),
      categoryId: calculus,
    });
    const chores = await insertItem(tx, unsaved(flexible("Chores", 600, utc("2026-09-01T00:00", "2026-10-30T00:00"))));
    const block = (taskId: string, start: string, end: string, status: PlacementStatus): Placement => ({
      taskId,
      ...utc(start, end),
      pinned: false,
      status,
    });
    await insertPlacements(tx, [
      block(essay, "2026-08-10T10:00", "2026-08-10T11:00", "done"), // before the 8 weeks
      block(essay, "2026-09-28T10:00", "2026-09-28T12:00", "done"),
      block(chores, "2026-09-29T10:00", "2026-09-29T10:30", "missed"),
      block(essay, "2026-10-05T10:00", "2026-10-05T11:00", "done"),
      block(chores, "2026-10-06T10:00", "2026-10-06T10:45", "done"),
      block(chores, "2026-10-07T09:00", "2026-10-07T10:00", "planned"), // to review
      block(essay, "2026-10-07T15:30", "2026-10-07T16:30", "planned"), // still running
    ]);

    const { weeks, categories } = await loadStats(tx, now);
    expect(weeks).toHaveLength(8);
    expect(weeks[0]).toMatchObject({ firstDate: "2026-08-17", doneMin: 0 });
    expect(weeks.at(-2)).toEqual({
      firstDate: "2026-09-28",
      lastDate: "2026-10-04",
      doneMin: 120,
      missedMin: 30,
      unreviewedMin: 0,
    });
    expect(weeks.at(-1)).toEqual({
      firstDate: "2026-10-05",
      lastDate: "2026-10-11",
      doneMin: 105,
      missedMin: 0,
      unreviewedMin: 60,
    });
    expect(categories).toEqual([
      { category: { id: calculus, name: "Calculus", color: "#f97316" }, doneMin: 180 },
      { category: null, doneMin: 45 },
    ]);
  });
});
