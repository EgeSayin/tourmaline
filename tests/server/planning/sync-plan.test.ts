import { nightly } from "@/lib/downtime";
import { describe, expect } from "vitest";
import { isFixed, type Task } from "@/lib/items";
import type { Placement, PlacementStatus } from "@/lib/placements";
import type { Recurrence } from "@/lib/recurrence";
import { RECURRENCE_LOOKAHEAD_DAYS, type SchedulerSettings } from "@/lib/settings";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { deleteItem, insertItem, loadItem, loadItems, saveOccurrence, setItemDone } from "@/server/db/items-repository";
import { insertPlacements, loadPlacements } from "@/server/db/placements-repository";
import { placements } from "@/server/db/schema";
import { loadUnplaced, syncPlan } from "@/server/planning/sync-plan";
import { expandOccurrences } from "@/server/recurrence";
import { dbTest as it } from "../../support/database";
import { utc } from "../../support/intervals";
import { minutesBetween } from "@/lib/time/duration";
import { localDate } from "@/server/time/temporal";
import { fixed, flexible } from "../../support/items";

const settings: SchedulerSettings = {
  timeZone: "America/New_York",
  downtime: nightly(23 * 60, 10 * 60),
};
const wednesdayNoon = new Date("2026-10-07T16:00Z"); // Wed Oct 7, 12:00 EDT
const week = utc("2026-10-05T04:00", "2026-10-12T04:00");
const daily: Recurrence = { frequency: "daily", interval: 1, until: null };
const auto = (taskId: string, times: { start: Date; end: Date }, status: PlacementStatus = "planned"): Placement => ({
  taskId,
  ...times,
  pinned: false,
  status,
});
const plan = async (tx: WorkspaceTx, now: Date, planSettings = settings) => {
  const items = await loadItems(tx);
  const result = await syncPlan(tx, items, planSettings, now);
  // The queue read back from the saved plan is what planning reported.
  const remaining = (tasks: Task[]) => tasks.map(({ id, durationMin }) => ({ id, durationMin }));
  expect(remaining(await loadUnplaced(tx, items, planSettings, now))).toEqual(remaining(result.unplaced));
  return result;
};

describe("syncPlan", () => {
  it("plans from now on around fixed items, saves the plan, and reports what doesn't fit", async ({ tx }) => {
    await insertItem(tx, fixed("Lecture", utc("2026-10-07T17:00", "2026-10-07T18:00"))); // Wed 13:00–14:00
    const essayId = await insertItem(tx, flexible("Essay", 90, utc("2026-10-05T04:00", "2026-10-09T21:00"))); // due Fri
    const lateId = await insertItem(tx, flexible("Late reading", 30, utc("2026-10-05T04:00", "2026-10-06T04:00")));
    const marathonId = await insertItem(tx, flexible("Marathon", 24 * 60, utc("2026-10-05T04:00", "2026-10-09T21:00")));
    // Missed on Monday: its time counts as not spent.
    await insertPlacements(tx, [auto(lateId, utc("2026-10-05T14:00", "2026-10-05T14:30"), "missed")]);

    const result = await plan(tx, wednesdayNoon);

    expect(result.placements).toEqual([auto(essayId, utc("2026-10-07T18:00", "2026-10-07T19:30"))]); // after the lecture
    // No free day is 24 hours long, and the late reading's deadline has passed.
    expect(result.unplaced.map((task) => [task.id, task.durationMin]).sort()).toEqual(
      [
        [lateId, 30],
        [marathonId, 24 * 60],
      ].sort(),
    );
    expect(await loadPlacements(tx, week)).toEqual([
      auto(lateId, utc("2026-10-05T14:00", "2026-10-05T14:30"), "missed"),
      ...result.placements,
    ]);
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

  it("counts done and unreviewed time as spent, plans missed time again, and plans later weeks", async ({ tx }) => {
    const essayId = await insertItem(tx, flexible("Essay", 120, utc("2026-09-28T04:00", "2026-10-09T21:00")));
    const doneLastWeek = auto(essayId, utc("2026-09-30T14:00", "2026-09-30T15:00"), "done");
    const missedMonday = auto(essayId, utc("2026-10-05T14:00", "2026-10-05T14:30"), "missed");
    const unreviewedTuesday = auto(essayId, utc("2026-10-06T14:00", "2026-10-06T14:30"));
    await insertPlacements(tx, [doneLastWeek, missedMonday, unreviewedTuesday]);
    const projectId = await insertItem(tx, flexible("Project", 60, utc("2026-10-12T14:00", "2026-10-16T21:00")));

    await plan(tx, wednesdayNoon);

    // The hour done last week and Tuesday's half hour, still to review, count, so 30 minutes remain. Monday's
    // missed half hour stays on record. The project is planned next Monday at 10:00.
    expect(await loadPlacements(tx, week)).toEqual([
      missedMonday,
      unreviewedTuesday,
      auto(essayId, utc("2026-10-07T16:00", "2026-10-07T16:30")),
    ]);
    expect(await loadPlacements(tx, utc("2026-10-12T04:00", "2026-10-19T04:00"))).toEqual([
      auto(projectId, utc("2026-10-12T14:00", "2026-10-12T15:00")),
    ]);
  });

  it("doesn't plan tasks or occurrences marked done, dropping their pending placements", async ({ tx }) => {
    const essayId = await insertItem(tx, flexible("Essay", 60, utc("2026-10-05T04:00", "2026-10-09T21:00")));
    // Due Fri, so the plan reaches Friday's gym.
    const reportId = await insertItem(tx, flexible("Report", 30, utc("2026-10-05T04:00", "2026-10-09T21:00")));
    const gymId = await insertItem(tx, {
      ...flexible("Gym", 60, utc("2026-10-07T14:00", "2026-10-08T14:00")), // daily from Wed 10:00
      recurrence: daily,
    });
    await plan(tx, wednesdayNoon);
    await setItemDone(tx, essayId, true);
    await saveOccurrence(tx, (await loadItem(tx, gymId))!, "2026-10-08", { state: "done" });

    const result = await plan(tx, wednesdayNoon);

    const planned = [reportId, `${gymId}@2026-10-07`, `${gymId}@2026-10-09`];
    expect(result.tasks.map((task) => task.id).sort()).toEqual(planned.sort());
    expect((await loadPlacements(tx, week)).map((p) => p.taskId).sort()).toEqual(planned.sort());

    // With the report done too, nothing reaches past now, so only today's gym is planned.
    await setItemDone(tx, reportId, true);
    expect((await plan(tx, wednesdayNoon)).tasks.map((task) => task.id)).toEqual([`${gymId}@2026-10-07`]);
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

  it("plans a missed occurrence of a task kept within its day again only that day, or queues it until the day ends", async ({
    tx,
  }) => {
    // Daily from 11:30, due by midnight; today's was missed.
    const lunchId = await insertItem(tx, {
      ...flexible("Lunch", 45, utc("2026-10-05T15:30", "2026-10-06T04:00")),
      recurrence: daily,
      withinPeriod: true,
    });
    const today = `${lunchId}@2026-10-07`;
    const missed = auto(today, utc("2026-10-07T15:30", "2026-10-07T16:15"), "missed");
    await insertPlacements(tx, [missed]);
    const todays = (result: { placements: Placement[] }) => result.placements.filter((p) => p.taskId === today);

    // The plan leaves the missed block out and gives its time back.
    expect(todays(await plan(tx, wednesdayNoon))).toEqual([auto(today, utc("2026-10-07T16:00", "2026-10-07T16:45"))]);

    // The rest of the day is taken: it waits in the queue rather than going to tomorrow morning.
    await insertItem(tx, fixed("Workshop", utc("2026-10-07T16:00", "2026-10-08T03:00")));
    const full = await plan(tx, wednesdayNoon);
    expect(todays(full)).toEqual([]);
    expect(full.unplaced.map((task) => [task.id, task.durationMin])).toEqual([[today, 45]]);

    // Once the day is over, it's gone.
    const thursdayNoon = new Date("2026-10-08T16:00Z");
    expect((await plan(tx, thursdayNoon)).unplaced).toEqual([]);
  });

  it("drops pending blocks past the plan's end when it shrinks", async ({ tx }) => {
    // The appointment on Friday makes the plan reach Friday's gym.
    const appointmentId = await insertItem(tx, fixed("Appointment", utc("2026-10-09T14:00", "2026-10-09T15:00")));
    await insertItem(tx, { ...flexible("Gym", 60, utc("2026-10-07T14:00", "2026-10-08T14:00")), recurrence: daily });
    expect((await plan(tx, wednesdayNoon)).placements).toHaveLength(3);

    await deleteItem(tx, (await loadItem(tx, appointmentId))!);
    const result = await plan(tx, wednesdayNoon);

    expect(result.placements).toHaveLength(1);
    expect(await loadPlacements(tx, week)).toEqual(result.placements);
  });

  it("plans a repeating task that takes what fits up to its duration each week, after due tasks, never queued", async ({
    tx,
  }) => {
    // Next Friday's trip makes the plan reach into next week.
    await insertItem(tx, fixed("Trip", utc("2026-10-16T14:00", "2026-10-16T15:00")));
    // Everything this week but Sunday 19:30 to 23:00, when downtime starts.
    await insertItem(tx, fixed("Busy", utc("2026-10-07T16:00", "2026-10-11T23:30")));
    // Weekly from Monday midnight, up to six hours in two-hour blocks.
    const gameId = await insertItem(tx, {
      ...flexible("Game", 6 * 60, utc("2026-10-05T04:00", "2026-10-12T04:00")),
      recurrence: { frequency: "weekly", interval: 1, weekdays: [1], until: null },
      split: { minChunkMin: 120, maxChunkMin: 120, breakMin: 30 },
      spread: "even",
      withinPeriod: true,
      upTo: true,
    });
    const [thisWeek, nextWeek] = [`${gameId}@2026-10-05`, `${gameId}@2026-10-12`];
    // Two hours done on Monday leave four for this week.
    await insertPlacements(tx, [auto(thisWeek, utc("2026-10-05T14:00", "2026-10-05T16:00"), "done")]);
    const planned = (result: { placements: Placement[] }, taskId: string) =>
      result.placements.filter((p) => p.taskId === taskId && p.status === "planned");

    const first = await plan(tx, wednesdayNoon);
    expect(first.unplaced).toEqual([]);
    // Room for one block of the two it may still take this week.
    const thisWeeks = planned(first, thisWeek);
    expect(thisWeeks.map((p) => minutesBetween(p.start, p.end))).toEqual([120]);
    expect(thisWeeks[0].start >= new Date("2026-10-11T23:30Z")).toBe(true);
    // Next week has room for far more, but gets its six hours, spread over the week.
    const nextWeeks = planned(first, nextWeek);
    expect(nextWeeks.map((p) => minutesBetween(p.start, p.end))).toEqual([120, 120, 120]);
    expect(new Set(nextWeeks.map((p) => localDate(p.start, settings.timeZone).dayOfWeek)).size).toBe(3);

    // A due task takes Sunday's time, and the game waits for next week without being queued.
    const reportId = await insertItem(tx, flexible("Report", 210, utc("2026-10-05T04:00", "2026-10-12T03:00")));
    const second = await plan(tx, wednesdayNoon);
    expect(second.unplaced).toEqual([]);
    expect(second.placements.filter((p) => p.taskId === reportId)).toEqual([
      auto(reportId, utc("2026-10-11T23:30", "2026-10-12T03:00")),
    ]);
    expect(planned(second, thisWeek)).toEqual([]);
    expect(planned(second, nextWeek)).toEqual(nextWeeks);

    // Planning again changes nothing.
    expect((await plan(tx, wednesdayNoon)).placements).toEqual(second.placements);
  });

  it("plans a repeating task only until its total is spent, missed time aside", async ({ tx }) => {
    // Friday's appointment makes the plan reach Friday.
    await insertItem(tx, fixed("Appointment", utc("2026-10-09T14:00", "2026-10-09T15:00")));
    const novelId = await insertItem(tx, {
      ...flexible("Novel", 60, utc("2026-10-05T04:00", "2026-10-06T04:00")),
      recurrence: daily,
      totalMin: 3 * 60,
    });
    await insertPlacements(tx, [
      auto(`${novelId}@2026-10-05`, utc("2026-10-05T14:00", "2026-10-05T15:00"), "done"),
      auto(`${novelId}@2026-10-06`, utc("2026-10-06T14:00", "2026-10-06T15:00"), "missed"),
    ]);

    const novels = (await plan(tx, wednesdayNoon)).placements.filter((p) => p.status === "planned");
    // Two hours left: today's and tomorrow's, none on Friday.
    expect(novels.map((p) => [p.taskId, minutesBetween(p.start, p.end)])).toEqual([
      [`${novelId}@2026-10-07`, 60],
      [`${novelId}@2026-10-08`, 60],
    ]);
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
