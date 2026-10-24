import { describe, expect } from "vitest";
import type { NewFixedItem, NewItem, NewTask } from "@/lib/items";
import type { OccurrenceChanges, Occurrences } from "@/lib/recurrence";
import { deleteCategory, insertCategory } from "@/server/db/categories-repository";
import { insertItem, loadItem, loadItems, saveOccurrence, updateItem } from "@/server/db/items-repository";
import { createGuestWorkspace } from "@/server/db/workspaces-repository";
import { dbTest as it, savepoint } from "../../support/database";

const lecture: NewFixedItem = {
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
  withinPeriod: false,
  upTo: false,
  totalMin: null,
  timeOfDay: null,
};

/** `item` as loaded: with its id, occurrence states and changes, and a task not done. */
const stored = (id: string, item: NewItem, occurrences: Occurrences = {}, changes: OccurrenceChanges = {}) => ({
  id,
  occurrences,
  changes,
  ...item,
  ...(item.timing === "flexible" && { done: false }),
});

describe("items repository", () => {
  it("reads back fixed items and tasks exactly as they were inserted, with their occurrence states", async ({ tx }) => {
    const occurrences: Occurrences = { "2026-10-07": "skipped" };
    const lectureId = await insertItem(tx, lecture, occurrences);
    const essayId = await insertItem(tx, essay);

    const loaded = await loadItems(tx);

    expect(loaded).toHaveLength(2);
    expect(loaded).toContainEqual(stored(lectureId, lecture, occurrences));
    expect(loaded).toContainEqual(stored(essayId, essay));
    expect(await loadItem(tx, essayId)).toEqual(stored(essayId, essay));
    expect(await loadItem(tx, "00000000-0000-4000-8000-000000000000")).toBeUndefined();
  });

  it("keeps each occurrence's state and change apart, clearing one without the other, and holds them to their kind", async ({
    tx,
  }) => {
    const gym: NewTask = { ...essay, title: "Gym", recurrence: { frequency: "daily", interval: 1, until: null } };
    const later = { start: new Date("2026-10-06T20:00Z"), end: new Date("2026-10-07T02:00Z"), durationMin: 90 };
    const gymId = await insertItem(tx, gym, { "2026-10-06": "done" }, { "2026-10-06": later, "2026-10-07": later });
    expect(await loadItems(tx)).toEqual([
      stored(gymId, gym, { "2026-10-06": "done" }, { "2026-10-06": later, "2026-10-07": later }),
    ]);

    await saveOccurrence(tx, (await loadItem(tx, gymId))!, "2026-10-06", { state: null });
    await saveOccurrence(tx, (await loadItem(tx, gymId))!, "2026-10-07", { change: null, state: "skipped" });
    expect(await loadItem(tx, gymId)).toEqual(stored(gymId, gym, { "2026-10-07": "skipped" }, { "2026-10-06": later }));

    // Only a task occurrence is done, and only it has a duration.
    const lectureId = await insertItem(tx, lecture);
    const fixedLecture = (await loadItem(tx, lectureId))!;
    await expect(
      savepoint(tx, (inner) => saveOccurrence(inner, fixedLecture, "2026-10-07", { state: "done" })),
    ).rejects.toThrow();
    const storedGym = (await loadItem(tx, gymId))!;
    await expect(
      savepoint(tx, (inner) =>
        saveOccurrence(inner, storedGym, "2026-10-08", { change: { ...later, durationMin: null } }),
      ),
    ).rejects.toThrow();
  });

  it("updates an item in place", async ({ tx }) => {
    const id = await insertItem(tx, lecture, { "2026-10-07": "skipped" });

    const moved = {
      ...lecture,
      title: "CS 101 lecture (moved)",
      start: new Date("2026-10-06T15:00:00Z"),
      end: new Date("2026-10-06T16:15:00Z"),
    };
    await updateItem(tx, id, moved, {}, {});
    expect(await loadItems(tx)).toEqual([stored(id, moved)]);
  });

  it("keeps an item's category in its workspace, saving a deleted or another workspace's one as none", async ({
    tx,
  }) => {
    const categoryId = await insertCategory(tx, { name: "CS 101", color: "#3b82f6" });
    const lectureId = await insertItem(tx, { ...lecture, categoryId });
    const essayId = await insertItem(tx, { ...essay, categoryId });
    expect(await loadItem(tx, lectureId)).toMatchObject({ categoryId });

    await deleteCategory(tx, categoryId);
    expect((await loadItems(tx)).map((item) => item.categoryId)).toEqual([null, null]);
    await updateItem(tx, essayId, { ...essay, categoryId }, {}, {}); // deleted in the meantime
    expect(await loadItem(tx, essayId)).toMatchObject({ categoryId: null });

    const { workspaceId } = await createGuestWorkspace(tx);
    const guestCategoryId = await savepoint(
      tx,
      (guestTx) => insertCategory(guestTx, { name: "Theirs", color: "#ef4444" }),
      workspaceId,
    );
    expect(await loadItem(tx, await insertItem(tx, { ...lecture, categoryId: guestCategoryId }))).toMatchObject({
      categoryId: null,
    });
  });

  it("rejects task durations and chunk sizes off the 5-minute grid, and a one-off task kept within a period", async ({
    tx,
  }) => {
    const invalid: NewItem[] = [
      { ...essay, durationMin: 62 },
      { ...essay, split: { minChunkMin: 32, maxChunkMin: 90 } },
      { ...essay, split: { minChunkMin: 30, maxChunkMin: 92 } },
      { ...essay, withinPeriod: true },
    ];
    for (const item of invalid) {
      await expect(savepoint(tx, (inner) => insertItem(inner, item))).rejects.toThrow();
    }
    await expect(insertItem(tx, essay)).resolves.toBeTypeOf("string");
    const weekly = { ...essay, recurrence: lecture.recurrence, withinPeriod: true };
    expect(await loadItem(tx, await insertItem(tx, weekly))).toMatchObject({ withinPeriod: true });
  });
});
