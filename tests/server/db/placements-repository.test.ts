import { describe, expect } from "vitest";
import type { Placement } from "@/lib/placements";
import { deleteItem, insertItem } from "@/server/db/items-repository";
import { insertPlacements, loadPlacements, replacePendingPlacements } from "@/server/db/placements-repository";
import { dbTest as it } from "../../support/database";
import { fixed, flexible } from "../../support/items";
import { utc } from "../../support/intervals";

const week = utc("2026-10-05T04:00", "2026-10-12T04:00");

describe("placements repository", { tags: ["integration", "critical"] }, () => {
  it("loads the placements overlapping a range, sorted by start", async ({ tx }) => {
    const essayId = await insertItem(tx, flexible("Essay", 120, week));
    const placement = (start: string, end: string, extra: Partial<Placement> = {}): Placement => ({
      itemId: essayId,
      ...utc(start, end),
      source: "auto",
      pinned: false,
      ...extra,
    });

    const wednesday = placement("2026-10-07T14:00", "2026-10-07T15:00", { source: "manual", pinned: true });
    const monday = placement("2026-10-05T14:00", "2026-10-05T15:00");
    const acrossWeekStart = placement("2026-10-05T03:00", "2026-10-05T05:00");
    const nextWeek = placement("2026-10-12T14:00", "2026-10-12T15:00");
    await insertPlacements(tx, [wednesday, nextWeek, monday, acrossWeekStart]);

    expect(await loadPlacements(tx, week)).toEqual([acrossWeekStart, monday, wednesday]);
  });

  it("only allows placements for flexible tasks and removes them with their task", async ({ tx }) => {
    const lectureId = await insertItem(tx, fixed("Lecture", utc("2026-10-05T14:00", "2026-10-05T15:00")));
    const essayId = await insertItem(tx, flexible("Essay", 60, week));
    const slot = { ...utc("2026-10-06T14:00", "2026-10-06T15:00"), source: "auto" as const, pinned: false };

    await expect(
      tx.transaction((nested) => insertPlacements(nested, [{ itemId: lectureId, ...slot }])),
    ).rejects.toThrow();

    await insertPlacements(tx, [{ itemId: essayId, ...slot }]);
    await deleteItem(tx, essayId);
    expect(await loadPlacements(tx, week)).toEqual([]);
  });

  it("replaces only the pending placements in range, keeping started, pinned and later ones", async ({ tx }) => {
    const essayId = await insertItem(tx, flexible("Essay", 600, utc("2026-10-05T04:00", "2026-10-19T04:00")));
    const placement = (start: string, end: string, extra: Partial<Placement> = {}): Placement => ({
      itemId: essayId,
      ...utc(start, end),
      source: "auto",
      pinned: false,
      ...extra,
    });
    const now = new Date("2026-10-07T12:00Z");

    const started = placement("2026-10-07T11:30", "2026-10-07T12:30");
    const pinned = placement("2026-10-08T14:00", "2026-10-08T15:00", { source: "manual", pinned: true });
    const stale = placement("2026-10-09T14:00", "2026-10-09T15:00");
    const nextWeek = placement("2026-10-13T14:00", "2026-10-13T15:00");
    await insertPlacements(tx, [started, pinned, stale, nextWeek]);

    const replacement = placement("2026-10-10T14:00", "2026-10-10T15:00");
    await replacePendingPlacements(tx, week, now, [
      started,
      pinned,
      replacement,
      placement("2026-10-14T14:00", "2026-10-14T15:00"),
    ]);

    expect(await loadPlacements(tx, utc("2026-10-05T04:00", "2026-10-19T04:00"))).toEqual([
      started,
      pinned,
      replacement,
      nextWeek,
    ]);
  });
});
