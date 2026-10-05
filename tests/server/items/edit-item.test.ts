import { describe, expect } from "vitest";
import type { FixedItem, NewItem } from "@/lib/items";
import type { Recurrence } from "@/lib/recurrence";
import { insertItem, loadItem, loadItems } from "@/server/db/items-repository";
import { occurrenceOverrides } from "@/server/db/schema";
import { editItem } from "@/server/items/edit-item";
import { dbTest as it } from "../../support/database";
import { utc } from "../../support/intervals";

const tz = "America/New_York";
const now = new Date("2026-10-07T16:00Z");

// Mondays 11:00–12:15 EDT from Sep 7, 2026.
const lecture: Omit<FixedItem, "id" | "overrides"> = {
  title: "Lecture",
  priority: "mandatory",
  timing: "fixed",
  recurrence: { frequency: "weekly", interval: 1, weekdays: [1], until: null } satisfies Recurrence,
  ...utc("2026-09-07T15:00", "2026-09-07T16:15"),
  location: null,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
};
const movedTo = (start: string, end: string, changes: Partial<NewItem> = {}): NewItem =>
  ({ ...lecture, ...utc(start, end), ...changes }) as NewItem;

describe("editItem", { tags: ["integration", "critical"] }, () => {
  it("ends a series that already occurred the day before the edit, and saves the edit as a new series", async ({
    tx,
  }) => {
    const id = await insertItem(tx, lecture);
    await tx.insert(occurrenceOverrides).values([
      { itemId: id, occurrenceDate: "2026-09-14", skipped: true },
      { itemId: id, occurrenceDate: "2026-10-19", skipped: true },
    ]);

    // From Mon Oct 12 on, at 14:00.
    const edited = movedTo("2026-10-12T18:00", "2026-10-12T19:15", { title: "Lecture (new room)" });
    const newId = await editItem(tx, id, edited, now, tz);

    expect(newId).not.toBe(id);
    expect(await loadItem(tx, id)).toEqual({
      id,
      ...lecture,
      recurrence: { ...lecture.recurrence, until: "2026-10-11" },
      overrides: [{ date: "2026-09-14", skipped: true }],
    });
    expect(await loadItem(tx, newId!)).toEqual({
      id: newId,
      ...edited,
      overrides: [{ date: "2026-10-19", skipped: true }],
    });
  });

  it("keeps an earlier end date, and ends the series for an edit that stops it repeating", async ({ tx }) => {
    const endsSoon = { ...lecture, recurrence: { ...lecture.recurrence!, until: "2026-09-20" } };
    const id = await insertItem(tx, endsSoon);
    await tx.insert(occurrenceOverrides).values({ itemId: id, occurrenceDate: "2026-10-19", skipped: true });

    const once = movedTo("2026-10-12T18:00", "2026-10-12T19:15", { recurrence: null });
    const newId = await editItem(tx, id, once, now, tz);

    expect(await loadItems(tx)).toHaveLength(2);
    expect(await loadItem(tx, id)).toMatchObject({ recurrence: { until: "2026-09-20" } });
    expect(await loadItem(tx, newId!)).toMatchObject({ recurrence: null, overrides: [] });
  });

  it("updates in place what hasn't occurred before the edit, and reports a missing item", async ({ tx }) => {
    // Edited from its first occurrence, or earlier.
    for (const start of ["2026-09-07T15:00", "2026-08-31T15:00"]) {
      const id = await insertItem(tx, lecture);
      const edited = movedTo(start, start.replace("15:00", "16:00"), { title: "Earlier" });
      expect(await editItem(tx, id, edited, now, tz)).toBe(id);
      expect(await loadItem(tx, id)).toEqual({ id, ...edited, overrides: [] });
    }

    // A series whose start isn't one of its days first occurs later: Wednesday start, Mondays only.
    const fromWednesday = movedTo("2026-09-09T15:00", "2026-09-09T16:15");
    const laterId = await insertItem(tx, fromWednesday);
    expect(await editItem(tx, laterId, movedTo("2026-09-14T15:00", "2026-09-14T16:15"), now, tz)).toBe(laterId);

    const onceId = await insertItem(tx, { ...lecture, recurrence: null });
    const moved = movedTo("2026-10-12T18:00", "2026-10-12T19:15", { recurrence: null });
    expect(await editItem(tx, onceId, moved, now, tz)).toBe(onceId);

    expect(await editItem(tx, "00000000-0000-4000-8000-000000000000", lecture, now, tz)).toBeUndefined();
  });
});
