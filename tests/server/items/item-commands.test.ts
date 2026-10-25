import { describe, expect } from "vitest";
import type { NewItem, Task } from "@/lib/items";
import type { Placement, PlacementStatus } from "@/lib/placements";
import { occurrenceId, type Recurrence } from "@/lib/recurrence";
import { insertItem, loadItem, loadItems } from "@/server/db/items-repository";
import { insertPlacements, loadPlacement, loadPlacements } from "@/server/db/placements-repository";
import {
  bumpTask,
  changeOccurrence,
  editItem,
  removeItem,
  setTaskDone,
  skipOccurrence,
} from "@/server/items/item-commands";
import { dbTest as it } from "../../support/database";
import { utc } from "../../support/intervals";
import { fixed, flexible, unsaved } from "../../support/items";

const tz = "America/New_York";
const now = new Date("2026-10-07T16:00Z");

// Mondays 11:00–12:15 EDT from Sep 7, 2026.
const lecture = unsaved({
  ...fixed("Lecture", utc("2026-09-07T15:00", "2026-09-07T16:15")),
  recurrence: { frequency: "weekly", interval: 1, weekdays: [1], until: null } satisfies Recurrence,
});
const movedTo = (start: string, end: string, changes: Partial<NewItem> = {}): NewItem =>
  ({ ...lecture, ...utc(start, end), ...changes }) as NewItem;

// Daily from Mon Oct 5, 10:00 EDT to 10:00 the next day.
const gym = {
  ...unsaved(flexible("Gym", 60, utc("2026-10-05T14:00", "2026-10-06T14:00"))),
  recurrence: { frequency: "daily", interval: 1, until: null } satisfies Recurrence,
};
const gymBlock = (
  gymId: string,
  date: string,
  start: string,
  end: string,
  pinned = false,
  status: PlacementStatus = "planned",
): Placement => ({ taskId: occurrenceId(gymId, date), ...utc(start, end), pinned, status });
const week = utc("2026-10-05T04:00", "2026-10-12T04:00");

describe("editItem", () => {
  it("ends a series that already occurred the day before the edit, and saves the edit as a new series", async ({
    tx,
  }) => {
    const id = await insertItem(tx, lecture, { "2026-09-14": "skipped", "2026-10-19": "skipped" });

    // From Mon Oct 12 on, at 14:00.
    const edited = movedTo("2026-10-12T18:00", "2026-10-12T19:15", { title: "Lecture (new room)" });
    const newId = await editItem(tx, id, edited, now, tz);

    expect(newId).not.toBe(id);
    expect(await loadItem(tx, id)).toEqual({
      id,
      ...lecture,
      recurrence: { ...lecture.recurrence, until: "2026-10-11" },
      occurrences: { "2026-09-14": "skipped" },
    });
    expect(await loadItem(tx, newId!)).toEqual({
      id: newId,
      ...edited,
      occurrences: { "2026-10-19": "skipped" },
    });
  });

  it("moves the blocks of the occurrences it takes over to the new series", async ({ tx }) => {
    const gymId = await insertItem(tx, gym);
    const yesterdays = gymBlock(gymId, "2026-10-06", "2026-10-06T14:00", "2026-10-06T15:00", false, "done");
    const doneToday = gymBlock(gymId, "2026-10-07", "2026-10-07T14:00", "2026-10-07T14:30", false, "done");
    const pinnedToday = gymBlock(gymId, "2026-10-07", "2026-10-07T17:00", "2026-10-07T17:30", true);
    await insertPlacements(tx, [
      yesterdays,
      doneToday,
      pinnedToday,
      gymBlock(gymId, "2026-10-08", "2026-10-08T14:00", "2026-10-08T15:00"),
    ]);

    // From today on, 90 minutes.
    const edited = { ...gym, earliestStart: new Date("2026-10-07T14:00Z"), deadline: new Date("2026-10-08T14:00Z") };
    const newId = await editItem(tx, gymId, { ...edited, durationMin: 90 }, now, tz);

    const moved = (block: Placement) => ({ ...block, taskId: occurrenceId(newId!, "2026-10-07") });
    expect(await loadPlacements(tx, week)).toEqual([yesterdays, moved(doneToday), moved(pinnedToday)]);
  });

  it("keeps an earlier end date, and ends the series for an edit that stops it repeating", async ({ tx }) => {
    const endsSoon = { ...lecture, recurrence: { ...lecture.recurrence!, until: "2026-09-20" } };
    const id = await insertItem(tx, endsSoon, { "2026-10-19": "skipped" });

    const once = movedTo("2026-10-12T18:00", "2026-10-12T19:15", { recurrence: null });
    const newId = await editItem(tx, id, once, now, tz);

    expect(await loadItems(tx)).toHaveLength(2);
    expect(await loadItem(tx, id)).toMatchObject({ recurrence: { until: "2026-09-20" } });
    expect(await loadItem(tx, newId!)).toMatchObject({ recurrence: null, occurrences: {} });
  });

  it("updates in place what hasn't occurred before the edit, and reports a missing item", async ({ tx }) => {
    // Edited from its first occurrence, or earlier.
    for (const start of ["2026-09-07T15:00", "2026-08-31T15:00"]) {
      const id = await insertItem(tx, lecture);
      const edited = movedTo(start, start.replace("15:00", "16:00"), { title: "Earlier" });
      expect(await editItem(tx, id, edited, now, tz)).toBe(id);
      expect(await loadItem(tx, id)).toEqual({ id, ...edited, occurrences: {} });
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

describe("removeItem", () => {
  it("ends a series that already occurred yesterday, and deletes anything else", async ({ tx }) => {
    // Wed Oct 7: the Mondays from Sep 7 stay, through Oct 5.
    const seriesId = await insertItem(tx, lecture);
    expect(await removeItem(tx, seriesId, now, tz)).toBe(true);
    expect(await loadItem(tx, seriesId)).toMatchObject({ recurrence: { until: "2026-10-06" } });

    const endsSoonId = await insertItem(tx, {
      ...lecture,
      recurrence: { ...lecture.recurrence!, until: "2026-09-20" },
    });
    await removeItem(tx, endsSoonId, now, tz);
    expect(await loadItem(tx, endsSoonId)).toMatchObject({ recurrence: { until: "2026-09-20" } });

    // First occurs today, or is a one-off: deleted.
    const startsTodayId = await insertItem(tx, {
      ...movedTo("2026-10-07T15:00", "2026-10-07T16:15"),
      recurrence: { ...lecture.recurrence!, weekdays: [3] },
    } as NewItem);
    const onceId = await insertItem(tx, { ...lecture, recurrence: null });
    for (const id of [startsTodayId, onceId]) {
      expect(await removeItem(tx, id, now, tz)).toBe(true);
      expect(await loadItem(tx, id)).toBeUndefined();
    }

    expect(await removeItem(tx, onceId, now, tz)).toBe(false);
  });

  it("drops the planned blocks of the removed occurrences from now on, pinned too, and keeps the rest", async ({
    tx,
  }) => {
    const gymId = await insertItem(tx, gym);
    const yesterdays = gymBlock(gymId, "2026-10-06", "2026-10-06T14:00", "2026-10-06T15:00", false, "done");
    const doneToday = gymBlock(gymId, "2026-10-07", "2026-10-07T14:00", "2026-10-07T15:00", false, "done");
    await insertPlacements(tx, [
      yesterdays,
      doneToday,
      gymBlock(gymId, "2026-10-07", "2026-10-07T17:00", "2026-10-07T18:00", true),
      gymBlock(gymId, "2026-10-08", "2026-10-08T14:00", "2026-10-08T15:00", true),
    ]);

    await removeItem(tx, gymId, now, tz);

    expect(await loadPlacements(tx, week)).toEqual([yesterdays, doneToday]);
  });
});

describe("editing in place", () => {
  it("keeps a task's started and pinned placements, replaces an item whose kind changes, and drops occurrence states once it stops recurring", async ({
    tx,
  }) => {
    const essay = unsaved(flexible("Essay", 240, utc("2026-10-05T04:00", "2026-10-12T04:00")));
    const essayId = await insertItem(tx, essay);
    const placed = (start: string, end: string, pinned = false) => ({
      taskId: essayId,
      ...utc(start, end),
      pinned,
      status: "planned" as const,
    });
    const started = placed("2026-10-07T15:00", "2026-10-07T17:00");
    const pinned = placed("2026-10-08T14:00", "2026-10-08T15:00", true);
    await insertPlacements(tx, [started, pinned, placed("2026-10-08T16:00", "2026-10-08T17:00")]);
    const week = utc("2026-10-05T04:00", "2026-10-12T04:00");

    await editItem(tx, essayId, { ...essay, durationMin: 300 }, now, tz);
    expect(await loadPlacements(tx, week)).toEqual([started, pinned]); // the rest is placed again
    // A new kind is saved as a new item, which for a fixed item drops the task's blocks.
    const asFixed = movedTo("2026-10-08T15:00", "2026-10-08T16:00", { recurrence: null });
    const fixedId = await editItem(tx, essayId, asFixed, now, tz);
    expect(fixedId).not.toBe(essayId);
    expect(await loadItem(tx, essayId)).toBeUndefined();
    expect(await loadItem(tx, fixedId!)).toEqual({ id: fixedId, ...asFixed, occurrences: {} });
    expect(await loadPlacements(tx, week)).toEqual([]);

    // A series that hasn't occurred yet, edited to happen once.
    const laterId = await insertItem(tx, movedTo("2026-10-12T15:00", "2026-10-12T16:15"), {
      "2026-10-19": "skipped",
    });
    await editItem(tx, laterId, movedTo("2026-10-12T15:00", "2026-10-12T16:15", { recurrence: null }), now, tz);
    expect(await loadItem(tx, laterId)).toMatchObject({ recurrence: null, occurrences: {} });
  });
});

describe("changes that free time", () => {
  it("leave the time free and keep other tasks' blocks where they are", async ({ tx }) => {
    const essayId = await insertItem(tx, unsaved(flexible("Essay", 60, utc("2026-10-07T04:00", "2026-10-12T04:00"))));
    const essayBlocks: Placement[] = [
      { taskId: essayId, ...utc("2026-10-08T18:00", "2026-10-08T19:00"), pinned: false, status: "planned" },
      { taskId: essayId, ...utc("2026-10-09T18:00", "2026-10-09T19:00"), pinned: true, status: "planned" },
    ];
    const lectureId = await insertItem(tx, lecture);
    const gymId = await insertItem(tx, gym);
    const shorterGym = { ...utc("2026-10-08T14:00", "2026-10-09T14:00"), durationMin: 30 };
    const changes: [string, () => Promise<unknown>][] = [
      ["less time", () => editItem(tx, gymId, { ...gym, durationMin: 30 }, now, tz)],
      ["shorter", () => editItem(tx, lectureId, movedTo("2026-09-07T15:00", "2026-09-07T16:00"), now, tz)],
      [
        "repeating differently",
        () =>
          editItem(
            tx,
            lectureId,
            movedTo("2026-09-07T15:00", "2026-09-07T16:00", {
              recurrence: { ...lecture.recurrence!, weekdays: [1, 3] },
            }),
            now,
            tz,
          ),
      ],
      ["one occurrence changed", () => changeOccurrence(tx, gymId, "2026-10-08", shorterGym, now, tz)],
      ["skipping", () => skipOccurrence(tx, gymId, "2026-10-08", now)],
      ["removing", () => removeItem(tx, gymId, now, tz)],
    ];

    await insertPlacements(tx, essayBlocks);
    for (const [change, run] of changes) {
      await run();
      expect([change, await loadPlacements(tx, week)]).toEqual([change, essayBlocks]);
    }
  });
});

describe("changeOccurrence", () => {
  it("gives one occurrence its own timing and resets it, refusing dates the series doesn't have and the wrong kind", async ({
    tx,
  }) => {
    const id = await insertItem(tx, lecture, { "2026-10-26": "skipped" });
    // Monday Oct 19's lecture on Tuesday 14:00.
    const tuesday = { ...utc("2026-10-20T18:00", "2026-10-20T19:00"), durationMin: null };

    expect(await changeOccurrence(tx, id, "2026-10-19", tuesday, now, tz)).toBe(true);
    expect((await loadItem(tx, id))!.changes).toEqual({ "2026-10-19": tuesday });
    expect(await changeOccurrence(tx, id, "2026-10-20", tuesday, now, tz)).toBe(false); // not a Monday
    expect(await changeOccurrence(tx, id, "2026-10-26", tuesday, now, tz)).toBe(false); // skipped
    expect(await changeOccurrence(tx, id, "2026-10-19", { ...tuesday, durationMin: 60 }, now, tz)).toBe(false);
    const gymId = await insertItem(tx, gym);
    expect(await changeOccurrence(tx, gymId, "2026-10-06", tuesday, now, tz)).toBe(false);

    expect(await changeOccurrence(tx, id, "2026-10-19", null, now, tz)).toBe(true);
    expect((await loadItem(tx, id))!.changes).toEqual({});
  });

  it("carries changes into a series edit while their dates still occur, and drops them when the kind changes", async ({
    tx,
  }) => {
    const own = (date: string) => ({ ...utc(`${date}T20:00`, `${date}T21:00`), durationMin: null });
    // Mondays, changed on Oct 12 and Oct 19.
    const id = await insertItem(tx, lecture, {}, { "2026-10-12": own("2026-10-13"), "2026-10-19": own("2026-10-20") });

    // From Oct 19 on, on Mondays and Wednesdays: Oct 12's stays with the old series, Oct 19's moves on.
    const newId = await editItem(
      tx,
      id,
      movedTo("2026-10-19T15:00", "2026-10-19T16:15", {
        recurrence: { frequency: "weekly", interval: 1, weekdays: [1, 3], until: null },
      }),
      now,
      tz,
    );
    expect((await loadItem(tx, id))!.changes).toEqual({ "2026-10-12": own("2026-10-13") });
    expect((await loadItem(tx, newId!))!.changes).toEqual({ "2026-10-19": own("2026-10-20") });

    // On Wednesdays only from Oct 19 on: Monday Oct 19 no longer occurs.
    const wednesdays = await editItem(
      tx,
      newId!,
      movedTo("2026-10-21T15:00", "2026-10-21T16:15", {
        recurrence: { frequency: "weekly", interval: 1, weekdays: [3], until: null },
      }),
      now,
      tz,
    );
    expect((await loadItem(tx, wednesdays!))!.changes).toEqual({});

    const kept = await insertItem(tx, lecture, {}, { "2026-10-19": own("2026-10-20") });
    const asTask = await editItem(
      tx,
      kept,
      { ...gym, ...utc("2026-10-19T15:00", "2026-10-20T15:00") } as NewItem,
      now,
      tz,
    );
    expect((await loadItem(tx, asTask!))!.changes).toEqual({});
  });
});

describe("skipOccurrence", () => {
  it("skips an occurrence of a series, dropping its later blocks, and refuses anything else", async ({ tx }) => {
    const seriesId = await insertItem(tx, lecture);
    expect(await skipOccurrence(tx, seriesId, "2026-09-14", now)).toBe(true);
    expect(await loadItem(tx, seriesId)).toMatchObject({ occurrences: { "2026-09-14": "skipped" } });

    const gymId = await insertItem(tx, gym);
    const started = gymBlock(gymId, "2026-10-07", "2026-10-07T15:30", "2026-10-07T16:30");
    const tomorrows = gymBlock(gymId, "2026-10-08", "2026-10-08T14:00", "2026-10-08T15:00", true);
    await insertPlacements(tx, [started, gymBlock(gymId, "2026-10-07", "2026-10-07T17:00", "2026-10-07T17:30", true)]);
    await insertPlacements(tx, [tomorrows]);
    await skipOccurrence(tx, gymId, "2026-10-07", now);
    expect(await loadPlacements(tx, week)).toEqual([started, tomorrows]);

    const onceId = await insertItem(tx, { ...lecture, recurrence: null });
    expect(await skipOccurrence(tx, onceId, "2026-09-14", now)).toBe(false);
    expect(await skipOccurrence(tx, "00000000-0000-4000-8000-000000000000", "2026-09-14", now)).toBe(false);
    expect(await loadItem(tx, onceId)).toMatchObject({ occurrences: {} });
  });
});

describe("setTaskDone", () => {
  it("marks a task or an occurrence done, checking off its started blocks and dropping later ones, and reopens it", async ({
    tx,
  }) => {
    const essayId = await insertItem(tx, flexible("Essay", 120, utc("2026-10-05T04:00", "2026-10-09T21:00")));
    const block = (start: string, end: string): Placement => ({
      taskId: essayId,
      ...utc(start, end),
      pinned: false,
      status: "planned",
    });
    const past = block("2026-10-07T14:00", "2026-10-07T15:00");
    const inProgress = block("2026-10-07T15:30", "2026-10-07T16:30");
    const pinned = { ...block("2026-10-08T14:00", "2026-10-08T15:00"), pinned: true };
    await insertPlacements(tx, [past, inProgress, pinned, block("2026-10-08T16:00", "2026-10-08T17:00")]);

    expect(await setTaskDone(tx, essayId, null, true, now)).toBe(true);
    expect(await loadItem(tx, essayId)).toMatchObject({ done: true });
    // Started blocks are checked off, and later ones dropped, pinned too.
    expect(await loadPlacements(tx, utc("2026-10-05T04:00", "2026-10-12T04:00"))).toEqual([
      { ...past, status: "done" },
      { ...inProgress, status: "done" },
    ]);
    expect(await setTaskDone(tx, essayId, null, false, now)).toBe(true);
    expect(await loadItem(tx, essayId)).toMatchObject({ done: false });

    const gymId = await insertItem(tx, {
      ...unsaved(flexible("Gym", 60, utc("2026-10-07T14:00", "2026-10-08T14:00"))),
      recurrence: { frequency: "daily", interval: 1, until: null },
    });
    expect(await setTaskDone(tx, gymId, "2026-10-08", true, now)).toBe(true);
    expect((await loadItem(tx, gymId))?.occurrences).toEqual({ "2026-10-08": "done" });
    expect(await setTaskDone(tx, gymId, "2026-10-08", false, now)).toBe(true);
    expect((await loadItem(tx, gymId))?.occurrences).toEqual({});

    // A one-off task has no occurrences, a series is only done one occurrence at a time, and a fixed item never.
    const lectureId = await insertItem(tx, lecture);
    expect(await setTaskDone(tx, essayId, "2026-10-08", true, now)).toBe(false);
    expect(await setTaskDone(tx, gymId, null, true, now)).toBe(false);
    expect(await setTaskDone(tx, lectureId, null, true, now)).toBe(false);
    expect(await setTaskDone(tx, "00000000-0000-4000-8000-000000000000", null, true, now)).toBe(false);
  });
});

describe("bumpTask", () => {
  it("moves a one-off task's earliest start to the block's start plus the amount, unpinning its blocks before then, and refuses a bump past its deadline or into too little time", async ({
    tx,
  }) => {
    // Default downtime: 23:00–10:00 UTC.
    // Two hours in progress, two left to place.
    const essayId = await insertItem(tx, flexible("Essay", 240, utc("2026-10-07T10:00", "2026-10-09T21:00")));
    const block = (start: string, end: string, pinned = false): Placement => ({
      taskId: essayId,
      ...utc(start, end),
      pinned,
      status: "planned",
    });
    const tonight = block("2026-10-07T18:00", "2026-10-07T19:00", true);
    const tomorrow = block("2026-10-08T14:00", "2026-10-08T15:00");
    const started = block("2026-10-07T15:00", "2026-10-07T17:00");
    await insertPlacements(tx, [tonight, tomorrow, started]);
    const earliestStart = async () => ((await loadItem(tx, essayId)) as Task).earliestStart;

    expect(await bumpTask(tx, tonight, 24 * 60, now)).toBe("bumped");
    expect(await earliestStart()).toEqual(new Date("2026-10-08T18:00Z"));
    expect((await loadPlacement(tx, tonight))!.pinned).toBe(false);

    expect(await bumpTask(tx, tonight, 3 * 24 * 60, now)).toBe("past-due"); // Oct 10 18:00, after the deadline
    expect(await bumpTask(tx, tonight, 2 * 24 * 60 + 120, now)).toBe("no-room"); // Oct 9 20:00: an hour left
    expect(await earliestStart()).toEqual(new Date("2026-10-08T18:00Z"));
    expect(await bumpTask(tx, tonight, 2 * 24 * 60, now)).toBe("bumped"); // Oct 9 18:00: three hours left
    expect(await earliestStart()).toEqual(new Date("2026-10-09T18:00Z"));

    expect(await bumpTask(tx, started, 60, now)).toBe(false);
    expect(await bumpTask(tx, { taskId: essayId, start: new Date("2026-10-08T09:00Z") }, 60, now)).toBe(false);
  });

  it("gives an occurrence its own window from the block's start plus the amount", async ({ tx }) => {
    const gymId = await insertItem(tx, gym);
    const block = gymBlock(gymId, "2026-10-07", "2026-10-07T18:00", "2026-10-07T19:00");
    await insertPlacements(tx, [block]);

    expect(await bumpTask(tx, block, 60, now)).toBe("bumped");
    expect((await loadItem(tx, gymId))!.changes).toEqual({
      "2026-10-07": { ...utc("2026-10-07T19:00", "2026-10-08T14:00"), durationMin: 60 },
    });
    expect(await bumpTask(tx, block, 24 * 60, now)).toBe("past-due");
  });
});
