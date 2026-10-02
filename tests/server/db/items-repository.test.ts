import { describe, expect } from "vitest";
import type { FixedItem, FlexibleItem } from "@/lib/items";
import { deleteItem, insertItem, loadItems, updateItem } from "@/server/db/items-repository";
import { insertPlacements, loadPlacements } from "@/server/db/placements-repository";
import { fixedItemDetails, flexibleItemDetails, items } from "@/server/db/schema";
import { dbTest as it } from "../../support/database";

const lecture: Omit<FixedItem, "id"> = {
  title: "CS 101 lecture",
  priority: "mandatory",
  timing: "fixed",
  start: new Date("2026-10-05T15:00:00Z"),
  end: new Date("2026-10-05T16:15:00Z"),
  location: "Science Hall 101",
  bufferBeforeMin: 15,
  bufferAfterMin: 10,
};

const essay: Omit<FlexibleItem, "id"> = {
  title: "Essay draft",
  priority: "high",
  timing: "flexible",
  durationMin: 120,
  earliestStart: new Date("2026-10-05T04:00:00Z"),
  deadline: new Date("2026-10-09T21:00:00Z"),
  split: { minChunkMin: 30, maxChunkMin: 90 },
  preferredWindows: [{ startMinute: 18 * 60, endMinute: 22 * 60 }],
  spread: "just-in-time",
};

describe("items repository", { tags: ["integration", "critical"] }, () => {
  it("reads back fixed and flexible items exactly as they were inserted", async ({ tx }) => {
    const lectureId = await insertItem(tx, lecture);
    const essayId = await insertItem(tx, essay);

    const loaded = await loadItems(tx);

    expect(loaded).toHaveLength(2);
    expect(loaded).toContainEqual({ id: lectureId, ...lecture });
    expect(loaded).toContainEqual({ id: essayId, ...essay });
  });

  it("refuses to load an item whose details row is missing", async ({ tx }) => {
    await tx.insert(items).values({ title: "Orphan", timing: "fixed" });

    await expect(loadItems(tx)).rejects.toThrow("has no details row");
  });

  it("updates an item in place, including switching between fixed and flexible", async ({ tx }) => {
    const essayId = await insertItem(tx, essay);
    const window = { start: essay.earliestStart, end: essay.deadline };
    const now = new Date("2026-10-07T12:00Z");
    const placed = (start: string, end: string) => ({
      itemId: essayId,
      start: new Date(start),
      end: new Date(end),
      source: "auto" as const,
      pinned: false,
    });
    const started = placed("2026-10-07T11:00Z", "2026-10-07T13:00Z");
    const pinned = { ...placed("2026-10-08T14:00Z", "2026-10-08T15:00Z"), pinned: true };
    await insertPlacements(tx, [started, pinned, placed("2026-10-08T16:00Z", "2026-10-08T17:00Z")]);
    expect(await updateItem(tx, essayId, { ...essay, durationMin: 240 }, now)).toBe(true);
    expect(await loadPlacements(tx, window)).toEqual([started, pinned]); // the rest is placed again
    expect(await updateItem(tx, essayId, lecture, now)).toBe(true);
    expect(await loadPlacements(tx, window)).toEqual([]); // fixed items have no placements
    await deleteItem(tx, essayId);

    const id = await insertItem(tx, lecture);

    const moved = {
      ...lecture,
      title: "CS 101 lecture (moved)",
      start: new Date("2026-10-06T15:00:00Z"),
      end: new Date("2026-10-06T16:15:00Z"),
    };
    expect(await updateItem(tx, id, moved, now)).toBe(true);
    expect(await loadItems(tx)).toEqual([{ id, ...moved }]);

    expect(await updateItem(tx, id, essay, now)).toBe(true);
    expect(await loadItems(tx)).toEqual([{ id, ...essay }]);
    expect(await tx.$count(fixedItemDetails)).toBe(0);

    expect(await updateItem(tx, "00000000-0000-4000-8000-000000000000", essay, now)).toBe(false);
  });

  it("deletes an item together with its details", async ({ tx }) => {
    const lectureId = await insertItem(tx, lecture);
    const essayId = await insertItem(tx, essay);

    expect(await deleteItem(tx, essayId)).toBe(true);
    expect(await loadItems(tx)).toEqual([{ id: lectureId, ...lecture }]);
    expect(await tx.$count(flexibleItemDetails)).toBe(0);

    expect(await deleteItem(tx, essayId)).toBe(false);
  });
});
