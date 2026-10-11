import { describe, expect } from "vitest";
import type { Placement } from "@/lib/placements";
import type { Recurrence } from "@/lib/recurrence";
import { insertItem, setItemDone } from "@/server/db/items-repository";
import { insertPlacements } from "@/server/db/placements-repository";
import { settings } from "@/server/db/schema";
import { loadCalendar } from "@/server/calendar";
import { loadTaskBlocks } from "@/server/tasks";
import { dbTest as it } from "../support/database";
import { utc } from "../support/intervals";
import { fixed, flexible, unsaved } from "../support/items";

const wednesdayNoon = new Date("2026-10-07T16:00Z"); // Wed Oct 7, 12:00 EDT
const daily: Recurrence = { frequency: "daily", interval: 1, until: null };

describe("the task list", { tags: ["integration", "critical"] }, () => {
  it("lists every item by its next date, with its kind and status, each opening as the calendar would", async ({
    tx,
  }) => {
    await tx
      .insert(settings)
      .values({ timeZone: "America/New_York", downtimeStartMinute: 23 * 60, downtimeEndMinute: 10 * 60 });

    const essay = await insertItem(tx, unsaved(flexible("Essay", 90, utc("2026-10-05T04:00", "2026-10-09T21:00"))));
    const marathon = await insertItem(
      tx,
      unsaved(flexible("Marathon", 24 * 60, utc("2026-10-05T04:00", "2026-10-08T21:00"))),
    );
    const report = await insertItem(tx, unsaved(flexible("Report", 60, utc("2026-10-05T04:00", "2026-10-10T21:00"))));
    await setItemDone(tx, report, true);
    const party = await insertItem(tx, unsaved(fixed("Party", utc("2026-10-03T23:00", "2026-10-04T03:00"))));
    const standup = await insertItem(tx, {
      ...unsaved(fixed("Standup", utc("2026-10-05T13:00", "2026-10-05T13:30"))), // 09:00 daily
      recurrence: daily,
    });

    const tasks = (await loadCalendar(tx, wednesdayNoon))!.tasks;

    expect(tasks.map(({ id, kind, recurring, when, status }) => ({ id, kind, recurring, when, status }))).toEqual([
      { id: party, kind: "event", recurring: false, when: new Date("2026-10-03T23:00Z"), status: "past" },
      // Its next occurrence is tomorrow's.
      { id: standup, kind: "event", recurring: true, when: new Date("2026-10-08T13:00Z"), status: "scheduled" },
      { id: marathon, kind: "task", recurring: false, when: new Date("2026-10-08T21:00Z"), status: "queued" },
      { id: essay, kind: "task", recurring: false, when: new Date("2026-10-09T21:00Z"), status: "scheduled" },
      { id: report, kind: "task", recurring: false, when: new Date("2026-10-10T21:00Z"), status: "done" },
    ]);
    expect(tasks.find((entry) => entry.id === standup)?.target).toMatchObject({
      item: { id: standup, start: new Date("2026-10-08T13:00Z") },
      occurrenceDate: null,
    });
  });

  it("loads a task's blocks by start, each in its state at now", async ({ tx }) => {
    const essay = await insertItem(tx, unsaved(flexible("Essay", 180, utc("2026-10-05T04:00", "2026-10-09T21:00"))));
    const other = await insertItem(tx, unsaved(flexible("Other", 60, utc("2026-10-05T04:00", "2026-10-09T21:00"))));
    const block = (taskId: string, start: string, end: string, extra: Partial<Placement> = {}): Placement => ({
      taskId,
      ...utc(start, end),
      source: "auto",
      pinned: false,
      status: "planned",
      ...extra,
    });
    await insertPlacements(tx, [
      block(essay, "2026-10-08T14:00", "2026-10-08T15:00", { pinned: true }),
      block(essay, "2026-10-06T14:00", "2026-10-06T15:00"),
      block(essay, "2026-10-05T14:00", "2026-10-05T15:00", { status: "done" }),
      block(other, "2026-10-07T14:00", "2026-10-07T15:00"),
    ]);

    const blocks = await loadTaskBlocks(tx, essay, wednesdayNoon);

    expect(blocks.map(({ start, placement: { state, pinned } }) => ({ start, state, pinned }))).toEqual([
      { start: new Date("2026-10-05T14:00Z"), state: "done", pinned: false },
      { start: new Date("2026-10-06T14:00Z"), state: "to-review", pinned: false },
      { start: new Date("2026-10-08T14:00Z"), state: "planned", pinned: true },
    ]);
  });
});
