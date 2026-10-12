import { nightly } from "@/lib/downtime";
import { describe, expect } from "vitest";
import type { Placement } from "@/lib/placements";
import type { Recurrence } from "@/lib/recurrence";
import { OCCURRENCES_SHOWN } from "@/lib/settings";
import { insertItem, loadItem, setItemDone, setOccurrences } from "@/server/db/items-repository";
import { insertPlacements } from "@/server/db/placements-repository";
import { settings } from "@/server/db/schema";
import { loadSchedule, loadTaskBlocks } from "@/server/tasks";
import { readCalendar } from "../support/calendar";
import { dbTest as it } from "../support/database";
import { utc } from "../support/intervals";
import { fixed, flexible, unsaved } from "../support/items";

const wednesdayNoon = new Date("2026-10-07T16:00Z"); // Wed Oct 7, 12:00 EDT
const daily: Recurrence = { frequency: "daily", interval: 1, until: null };

describe("the task list", () => {
  it("lists every item by its next date, with its kind and status, each opening as the calendar would", async ({
    tx,
  }) => {
    await tx.update(settings).set({ timeZone: "America/New_York", downtime: nightly(23 * 60, 10 * 60) });

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

    const tasks = (await readCalendar(tx, wednesdayNoon))!.tasks;

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

  it("loads an item's schedule: a one-off task's blocks, or a series' next occurrences with theirs", async ({ tx }) => {
    const timeZone = "America/New_York";
    const essay = await insertItem(tx, unsaved(flexible("Essay", 60, utc("2026-10-05T04:00", "2026-10-09T21:00"))));
    // Daily from Mon Oct 5, 10:00 EDT, each due by the next day's 10:00.
    const gym = await insertItem(tx, {
      ...unsaved(flexible("Gym", 60, utc("2026-10-05T14:00", "2026-10-06T14:00"))),
      recurrence: daily,
    });
    const standup = await insertItem(tx, {
      ...unsaved(fixed("Standup", utc("2026-10-05T13:00", "2026-10-05T13:30"))),
      recurrence: { ...daily, until: "2026-10-09" },
    });
    const party = await insertItem(tx, unsaved(fixed("Party", utc("2026-10-10T23:00", "2026-10-11T03:00"))));
    const placed = (taskId: string, start: string, end: string): Placement => ({
      taskId,
      ...utc(start, end),
      pinned: false,
      status: "planned",
    });
    await insertPlacements(tx, [
      placed(essay, "2026-10-08T14:00", "2026-10-08T15:00"),
      placed(`${gym}@2026-10-07`, "2026-10-07T18:00", "2026-10-07T19:00"),
      placed(`${gym}@2026-10-08`, "2026-10-08T18:00", "2026-10-08T19:00"),
    ]);
    await setOccurrences(tx, (await loadItem(tx, gym))!, { "2026-10-08": "done", "2026-10-09": "skipped" });

    const essaySchedule = await loadSchedule(tx, essay, wednesdayNoon, timeZone);
    expect(essaySchedule.occurrences).toEqual([]);
    expect(essaySchedule.blocks.map((block) => block.start)).toEqual([new Date("2026-10-08T14:00Z")]);

    // Wednesday's occurrence is still open at noon; Friday's is skipped.
    const gymSchedule = await loadSchedule(tx, gym, wednesdayNoon, timeZone);
    expect(gymSchedule.blocks).toEqual([]);
    expect(gymSchedule.occurrences).toHaveLength(OCCURRENCES_SHOWN);
    expect(
      gymSchedule.occurrences.slice(0, 3).map(({ date, end, blocks }) => ({
        date,
        end,
        blocks: blocks.map((block) => block.start),
      })),
    ).toEqual([
      { date: "2026-10-07", end: new Date("2026-10-08T14:00Z"), blocks: [new Date("2026-10-07T18:00Z")] },
      { date: "2026-10-08", end: new Date("2026-10-09T14:00Z"), blocks: [new Date("2026-10-08T18:00Z")] },
      { date: "2026-10-10", end: new Date("2026-10-11T14:00Z"), blocks: [] },
    ]);

    // Wednesday's has ended by noon, and the series ends on Friday.
    const standupSchedule = await loadSchedule(tx, standup, wednesdayNoon, timeZone);
    expect(standupSchedule.occurrences.map(({ date, start, blocks }) => ({ date, start, blocks }))).toEqual([
      { date: "2026-10-08", start: new Date("2026-10-08T13:00Z"), blocks: [] },
      { date: "2026-10-09", start: new Date("2026-10-09T13:00Z"), blocks: [] },
    ]);

    expect(await loadSchedule(tx, party, wednesdayNoon, timeZone)).toEqual({ blocks: [], occurrences: [] });
    expect(await loadSchedule(tx, crypto.randomUUID(), wednesdayNoon, timeZone)).toEqual({
      blocks: [],
      occurrences: [],
    });
  });
});
