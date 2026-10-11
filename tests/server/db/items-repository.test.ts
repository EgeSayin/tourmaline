import { describe, expect } from "vitest";
import type { FixedItem, NewItem, NewTask } from "@/lib/items";
import type { OccurrenceOverride } from "@/lib/recurrence";
import {
  deleteItem,
  deleteOverrides,
  insertItem,
  loadItems,
  setItemDone,
  setOccurrenceDone,
  skipOccurrence,
  updateItem,
} from "@/server/db/items-repository";
import { insertPlacements, loadPlacements } from "@/server/db/placements-repository";
import { fixedItemDetails, flexibleItemDetails, items, occurrenceOverrides } from "@/server/db/schema";
import { dbTest as it } from "../../support/database";

const lecture: Omit<FixedItem, "id" | "overrides"> = {
  title: "CS 101 lecture",
  priority: "mandatory",
  timing: "fixed",
  recurrence: { frequency: "weekly", interval: 1, weekdays: [1, 3], until: "2026-12-11" },
  categoryId: null,
  start: new Date("2026-10-05T15:00:00Z"),
  end: new Date("2026-10-05T16:15:00Z"),
  location: "Science Hall 101",
  bufferBeforeMin: 15,
  bufferAfterMin: 10,
};

const essay: NewTask = {
  title: "Essay draft",
  priority: "high",
  timing: "flexible",
  recurrence: null,
  categoryId: null,
  durationMin: 120,
  earliestStart: new Date("2026-10-05T04:00:00Z"),
  deadline: new Date("2026-10-09T21:00:00Z"),
  split: { minChunkMin: 30, maxChunkMin: 90 },
  spread: "just-in-time",
};

/** `item` as loaded: with its id and overrides, and a task not done. */
const stored = (id: string, item: NewItem, overrides: OccurrenceOverride[] = []) => ({
  id,
  overrides,
  ...item,
  ...(item.timing === "flexible" && { done: false }),
});

describe("items repository", () => {
  it("reads back fixed items and tasks exactly as they were inserted", async ({ tx }) => {
    const lectureId = await insertItem(tx, lecture);
    const essayId = await insertItem(tx, essay);

    const loaded = await loadItems(tx);

    expect(loaded).toHaveLength(2);
    expect(loaded).toContainEqual(stored(lectureId, lecture));
    expect(loaded).toContainEqual(stored(essayId, essay));
  });

  it("refuses to load an item whose details row is missing", async ({ tx }) => {
    await tx.insert(items).values({ title: "Orphan", timing: "fixed" });

    await expect(loadItems(tx)).rejects.toThrow("has no details row");
  });

  it("updates an item in place, including switching between fixed and flexible", async ({ tx }) => {
    const id = await insertItem(tx, lecture);

    const moved = {
      ...lecture,
      title: "CS 101 lecture (moved)",
      start: new Date("2026-10-06T15:00:00Z"),
      end: new Date("2026-10-06T16:15:00Z"),
    };
    expect(await updateItem(tx, id, moved)).toBe(true);
    expect(await loadItems(tx)).toEqual([stored(id, moved)]);

    expect(await updateItem(tx, id, essay)).toBe(true);
    expect(await loadItems(tx)).toEqual([stored(id, essay)]);
    expect(await tx.$count(fixedItemDetails)).toBe(0);

    // A task with placements can't become fixed: they must be deleted first.
    const slot = {
      taskId: id,
      start: essay.earliestStart,
      end: essay.deadline,
      pinned: false,
      status: "planned" as const,
    };
    await insertPlacements(tx, [slot]);
    await expect(tx.transaction((inner) => updateItem(inner, id, lecture))).rejects.toThrow();
    expect(await loadPlacements(tx, { start: essay.earliestStart, end: essay.deadline })).toEqual([slot]);

    expect(await updateItem(tx, "00000000-0000-4000-8000-000000000000", essay)).toBe(false);
  });

  it("rejects task durations and chunk sizes off the 5-minute grid", async ({ tx }) => {
    const offGrid: NewItem[] = [
      { ...essay, durationMin: 62 },
      { ...essay, split: { minChunkMin: 32, maxChunkMin: 90 } },
      { ...essay, split: { minChunkMin: 30, maxChunkMin: 92 } },
    ];
    for (const item of offGrid) {
      await expect(tx.transaction((inner) => insertItem(inner, item))).rejects.toThrow();
    }
    await expect(insertItem(tx, essay)).resolves.toBeTypeOf("string");
  });

  it("keeps occurrence overrides, one per date and sorted by it, until they're deleted", async ({ tx }) => {
    const id = await insertItem(tx, lecture);
    const later = { date: "2026-10-19", skipped: true, done: false };
    const earlier = { date: "2026-10-07", skipped: true, done: false };
    const override = ({ date, skipped }: OccurrenceOverride) => ({ itemId: id, occurrenceDate: date, skipped });
    await tx.insert(occurrenceOverrides).values([override(later), override(earlier)]);
    const everyOtherWeek = { ...lecture, recurrence: { ...lecture.recurrence!, interval: 2 } };
    expect(await updateItem(tx, id, everyOtherWeek)).toBe(true);
    expect(await loadItems(tx)).toEqual([stored(id, everyOtherWeek, [earlier, later])]);
    await expect(
      tx.transaction((inner) =>
        inner.insert(occurrenceOverrides).values(override({ ...earlier, skipped: false, done: false })),
      ),
    ).rejects.toThrow(); // one per occurrence date

    // Skipping adds an override, or marks an existing one as skipped.
    await tx.insert(occurrenceOverrides).values(override({ date: "2026-10-26", skipped: false, done: false }));
    await skipOccurrence(tx, id, "2026-10-26");
    await skipOccurrence(tx, id, "2026-11-02");
    expect((await loadItems(tx))[0].overrides).toEqual([
      earlier,
      later,
      { date: "2026-10-26", skipped: true, done: false },
      { date: "2026-11-02", skipped: true, done: false },
    ]);

    await deleteOverrides(tx, id);
    expect(await loadItems(tx)).toEqual([stored(id, everyOtherWeek)]);

    await tx.insert(occurrenceOverrides).values(override(earlier));
    await deleteItem(tx, id);
    expect(await tx.$count(occurrenceOverrides)).toBe(0);
  });

  it("marks one-off tasks and occurrences done, keeping it through edits and other overrides", async ({ tx }) => {
    const essayId = await insertItem(tx, essay);
    await setItemDone(tx, essayId, true);
    await updateItem(tx, essayId, { ...essay, title: "Essay, final" });
    expect(await loadItems(tx)).toEqual([{ ...stored(essayId, { ...essay, title: "Essay, final" }), done: true }]);

    const gym = { ...essay, title: "Gym", recurrence: { frequency: "daily", interval: 1, until: null } } as const;
    const gymId = await insertItem(tx, gym);
    await skipOccurrence(tx, gymId, "2026-10-07");
    await setOccurrenceDone(tx, gymId, "2026-10-07", true);
    await setOccurrenceDone(tx, gymId, "2026-10-08", true);
    await setOccurrenceDone(tx, gymId, "2026-10-08", false);
    expect((await loadItems(tx)).find((item) => item.id === gymId)?.overrides).toEqual([
      { date: "2026-10-07", skipped: true, done: true },
      { date: "2026-10-08", skipped: false, done: false },
    ]);
  });

  it("deletes an item together with its details", async ({ tx }) => {
    const lectureId = await insertItem(tx, lecture);
    const essayId = await insertItem(tx, essay);

    expect(await deleteItem(tx, essayId)).toBe(true);
    expect(await loadItems(tx)).toEqual([stored(lectureId, lecture)]);
    expect(await tx.$count(flexibleItemDetails)).toBe(0);

    expect(await deleteItem(tx, essayId)).toBe(false);
  });
});
