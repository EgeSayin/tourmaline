import { describe, expect } from "vitest";
import { isFixed } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import type { Recurrence } from "@/lib/recurrence";
import { RECURRENCE_LOOKAHEAD_DAYS, type SchedulerSettings } from "@/lib/settings";
import type { Transaction } from "@/server/db/connection";
import { insertItem, loadItems } from "@/server/db/items-repository";
import { insertPlacements, loadPlacements } from "@/server/db/placements-repository";
import { placements } from "@/server/db/schema";
import { syncPlan } from "@/server/planning/sync-plan";
import { expandOccurrences } from "@/server/recurrence";
import { dbTest as it } from "../../support/database";
import { utc } from "../../support/intervals";
import { fixed, flexible } from "../../support/items";

const settings: SchedulerSettings = {
  timeZone: "America/New_York",
  downtime: { startMinute: 23 * 60, endMinute: 10 * 60 },
};
const wednesdayNoon = new Date("2026-10-07T16:00Z"); // Wed Oct 7, 12:00 EDT
const week = utc("2026-10-05T04:00", "2026-10-12T04:00");
const daily: Recurrence = { frequency: "daily", interval: 1, until: null };
const auto = (taskId: string, times: { start: Date; end: Date }, done = false): Placement => ({
  taskId,
  ...times,
  source: "auto",
  pinned: false,
  done,
});
const plan = async (tx: Transaction, now: Date) => syncPlan(tx, await loadItems(tx), settings, now);

describe("syncPlan", { tags: ["integration", "critical"] }, () => {
  it("plans from now on around fixed items, saves the plan, and reports what doesn't fit", async ({ tx }) => {
    await insertItem(tx, fixed("Lecture", utc("2026-10-07T17:00", "2026-10-07T18:00"))); // Wed 13:00–14:00
    const essayId = await insertItem(tx, flexible("Essay", 90, utc("2026-10-05T04:00", "2026-10-09T21:00"))); // due Fri
    const lateId = await insertItem(tx, flexible("Late reading", 30, utc("2026-10-05T04:00", "2026-10-06T04:00")));
    const marathonId = await insertItem(tx, flexible("Marathon", 24 * 60, utc("2026-10-05T04:00", "2026-10-09T21:00")));

    const result = await plan(tx, wednesdayNoon);

    expect(result.placements).toEqual([auto(essayId, utc("2026-10-07T18:00", "2026-10-07T19:30"))]); // after the lecture
    // No free day is 24 hours long, and the late reading's deadline has passed.
    expect(result.unplaced.map((task) => [task.id, task.durationMin]).sort()).toEqual(
      [
        [lateId, 30],
        [marathonId, 24 * 60],
      ].sort(),
    );
    expect(await loadPlacements(tx, week)).toEqual(result.placements);
  });

  it("keeps the saved plan when re-planning, adding a task that fits, or as time passes", async ({ tx }) => {
    const essayId = await insertItem(tx, flexible("Essay", 90, utc("2026-10-05T04:00", "2026-10-09T21:00")));
    const first = await plan(tx, wednesdayNoon);
    expect(first.placements).toEqual([auto(essayId, utc("2026-10-07T16:00", "2026-10-07T17:30"))]);

    const savedIds = async () => (await tx.select({ id: placements.id }).from(placements)).map((row) => row.id);
    const idsBefore = await savedIds();
    expect((await plan(tx, wednesdayNoon)).placements).toEqual(first.placements);
    expect(await savedIds()).toEqual(idsBefore); // nothing rewritten

    const readingId = await insertItem(tx, flexible("Reading", 30, utc("2026-10-05T04:00", "2026-10-09T21:00")));
    const withReading = await plan(tx, wednesdayNoon);
    expect(withReading.placements).toEqual([
      ...first.placements,
      auto(readingId, utc("2026-10-07T17:30", "2026-10-07T18:00")),
    ]);

    // Half an hour into the essay, both placements stay where they are.
    expect((await plan(tx, new Date("2026-10-07T16:30Z"))).placements).toEqual(withReading.placements);
    expect(await loadPlacements(tx, week)).toEqual(withReading.placements);
  });

  it("counts done placements as time spent, plans missed time again, and plans later weeks", async ({ tx }) => {
    const essayId = await insertItem(tx, flexible("Essay", 90, utc("2026-09-28T04:00", "2026-10-09T21:00")));
    const doneLastWeek = auto(essayId, utc("2026-09-30T14:00", "2026-09-30T15:00"), true);
    const missedMonday = auto(essayId, utc("2026-10-05T14:00", "2026-10-05T14:30"));
    await insertPlacements(tx, [doneLastWeek, missedMonday]);
    const projectId = await insertItem(tx, flexible("Project", 60, utc("2026-10-12T14:00", "2026-10-16T21:00")));

    await plan(tx, wednesdayNoon);

    // Only the hour done last week counts, so 30 minutes remain; Monday's missed half hour stays on record.
    // The project is planned next Monday at 10:00.
    expect(await loadPlacements(tx, week)).toEqual([
      missedMonday,
      auto(essayId, utc("2026-10-07T16:00", "2026-10-07T16:30")),
    ]);
    expect(await loadPlacements(tx, utc("2026-10-12T04:00", "2026-10-19T04:00"))).toEqual([
      auto(projectId, utc("2026-10-12T14:00", "2026-10-12T15:00")),
    ]);
  });

  it("plans recurring tasks only while they overlap the plan, around recurring fixed items", async ({ tx }) => {
    // The plan runs to the essay's deadline, Fri 10:30.
    await insertItem(tx, flexible("Essay", 60, utc("2026-10-05T04:00", "2026-10-09T14:30")));
    const standup = { ...fixed("Standup", utc("2026-10-05T17:00", "2026-10-05T17:30")), recurrence: daily }; // 13:00
    await insertItem(tx, standup);
    // Starts next week; its first occurrence doesn't extend the plan either.
    await insertItem(tx, {
      ...fixed("Seminar", utc("2026-10-12T14:00", "2026-10-12T15:00")),
      recurrence: { frequency: "weekly", interval: 1, weekdays: [1], until: null },
    });
    const gymId = await insertItem(tx, {
      ...flexible("Gym", 60, utc("2026-10-05T14:00", "2026-10-06T14:00")), // 10:00 to 10:00 the next day
      recurrence: daily,
    });

    const result = await plan(tx, wednesdayNoon);

    // Friday's window runs to Saturday 10:00, so it gets room after 10:30.
    const gymPlacements = result.placements.filter((p) => p.taskId.startsWith(gymId));
    expect(gymPlacements.map((p) => p.taskId)).toEqual(
      ["2026-10-07", "2026-10-08", "2026-10-09"].map((date) => `${gymId}@${date}`),
    );
    expect(gymPlacements.at(-1)!.end > new Date("2026-10-09T14:30Z")).toBe(true);
    expect(result.unplaced).toEqual([]);

    const standups = expandOccurrences({ ...standup, id: "standup" }, week, settings.timeZone).filter(isFixed);
    for (const p of result.placements) {
      expect(standups.some((s) => p.start < s.end && p.end > s.start)).toBe(false);
    }
  });

  it(`plans recurring tasks at most ${RECURRENCE_LOOKAHEAD_DAYS} days ahead, however far the plan reaches`, async ({
    tx,
  }) => {
    await insertItem(tx, flexible("Thesis", 60, utc("2026-10-05T04:00", "2027-03-01T05:00"))); // due in 5 months
    await insertItem(tx, { ...flexible("Gym", 60, utc("2026-10-05T14:00", "2026-10-06T14:00")), recurrence: daily });

    const { tasks } = await plan(tx, wednesdayNoon);
    const gyms = tasks.filter((task) => task.title === "Gym");

    // Today's occurrence (from 10:00) through the one starting on the last day of the lookahead.
    expect(gyms).toHaveLength(RECURRENCE_LOOKAHEAD_DAYS + 1);
    expect(gyms.at(-1)!.earliestStart < new Date("2026-11-04T16:00Z")).toBe(true);
  });
});
