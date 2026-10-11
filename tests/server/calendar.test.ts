import { nightly } from "@/lib/downtime";
import { describe, expect } from "vitest";
import type { Placement } from "@/lib/placements";
import type { Recurrence } from "@/lib/recurrence";
import { type Calendar, loadCalendar } from "@/server/calendar";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { insertItem } from "@/server/db/items-repository";
import { insertPlacements } from "@/server/db/placements-repository";
import { settings } from "@/server/db/schema";
import { dbTest as it } from "../support/database";
import { utc } from "../support/intervals";
import { fixed, flexible } from "../support/items";

const wednesdayNoon = new Date("2026-10-07T16:00Z"); // Wed Oct 7, 12:00 EDT
const daily: Recurrence = { frequency: "daily", interval: 1, until: null };
const auto = (taskId: string, times: { start: Date; end: Date }): Placement => ({
  taskId,
  ...times,
  pinned: false,
  status: "planned",
});
const show = (calendar: Calendar | null) =>
  calendar!.blocks.map((block) => `${block.title} ${block.date} ${block.startMinute / 60}`);

async function saveSettings(tx: WorkspaceTx) {
  await tx.update(settings).set({ timeZone: "America/New_York", downtime: nightly(23 * 60, 10 * 60) });
}

describe("loadCalendar", () => {
  it("returns the shown days with their blocks and the queue", async ({ tx }) => {
    await saveSettings(tx);
    await insertItem(tx, fixed("Lecture", utc("2026-10-07T17:00", "2026-10-07T18:00"))); // Wed 13:00–14:00
    await insertItem(tx, flexible("Essay", 90, utc("2026-10-05T04:00", "2026-10-09T21:00"))); // due Fri
    await insertItem(tx, flexible("Late reading", 30, utc("2026-10-05T04:00", "2026-10-06T04:00"))); // due Mon
    const marathon = flexible("Marathon", 24 * 60, utc("2026-10-05T04:00", "2026-10-09T21:00"));
    const marathonId = await insertItem(tx, marathon);

    const calendar = await loadCalendar(tx, wednesdayNoon);

    expect(calendar?.weekDates).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    expect(calendar?.dayDates).toEqual(["2026-10-07", "2026-10-08", "2026-10-09"]); // from today
    expect(calendar?.today).toBe("2026-10-07");
    expect(calendar?.navigation).toEqual({
      week: { previous: "2026-09-28", next: "2026-10-12", weeksFromToday: 0 },
      days: { previous: "2026-10-04", next: "2026-10-10" },
    });
    expect(show(calendar)).toEqual(["Lecture 2026-10-07 13", "Essay 2026-10-07 14"]); // planned after the lecture
    // The late reading doesn't fit either, but its deadline has passed, so it's hidden.
    expect(calendar?.queue).toEqual([
      {
        key: marathonId,
        title: "Marathon",
        remainingMin: 24 * 60,
        deadline: marathon.deadline,
        target: { item: { ...marathon, id: marathonId }, occurrenceDate: null },
      },
    ]);
  });

  it("shows the saved placements of earlier and later days", async ({ tx }) => {
    await saveSettings(tx);
    const essayId = await insertItem(tx, flexible("Essay", 90, utc("2026-09-28T04:00", "2026-10-09T21:00")));
    await insertPlacements(tx, [auto(essayId, utc("2026-09-30T14:00", "2026-09-30T15:00"))]); // Wed Sep 30, 10:00
    await insertItem(tx, flexible("Project", 60, utc("2026-10-12T14:00", "2026-10-16T21:00")));

    const lastWeek = await loadCalendar(tx, wednesdayNoon, Temporal.PlainDate.from("2026-10-01"));
    expect(lastWeek?.weekDates[0]).toBe("2026-09-28");
    expect(show(lastWeek)).toEqual(["Essay 2026-09-30 10"]);
    expect(show(await loadCalendar(tx, wednesdayNoon, Temporal.PlainDate.from("2026-10-12")))).toEqual([
      "Project 2026-10-12 10",
    ]);

    // Three days from Saturday reach into next week, so its blocks come along with the week's.
    const saturday = await loadCalendar(tx, wednesdayNoon, Temporal.PlainDate.from("2026-10-10"));
    expect(saturday?.dayDates).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
    expect(show(saturday)).toEqual(["Essay 2026-10-07 12", "Project 2026-10-12 10"]);
  });

  it("lists every past block still to review, oldest first, and leaves reviewed ones out", async ({ tx }) => {
    await saveSettings(tx);
    const essay = flexible("Essay", 300, utc("2026-09-28T04:00", "2026-10-09T21:00"));
    const essayId = await insertItem(tx, essay);
    const block = (start: string, end: string, status: Placement["status"] = "planned") => ({
      ...auto(essayId, utc(start, end)),
      status,
    });
    const lastWeek = block("2026-09-30T14:00", "2026-09-30T15:00");
    const monday = block("2026-10-05T14:00", "2026-10-05T15:00");
    await insertPlacements(tx, [
      monday,
      lastWeek,
      block("2026-10-06T14:00", "2026-10-06T15:00", "done"),
      block("2026-10-06T16:00", "2026-10-06T17:00", "missed"),
      block("2026-10-07T15:30", "2026-10-07T16:30"), // in progress
    ]);

    const calendar = await loadCalendar(tx, wednesdayNoon);

    const target = { item: { ...essay, id: essayId }, occurrenceDate: null };
    expect(calendar?.review).toEqual(
      [lastWeek, monday].map(({ taskId, start, end }) => ({
        key: expect.any(String),
        title: "Essay",
        start,
        end,
        ref: { taskId, start },
        target,
      })),
    );
    expect(calendar!.blocks.map((block) => block.placement?.state)).toEqual([
      "to-review",
      "done",
      "missed",
      "in-progress",
      "planned", // the hour left, placed after now; to review and in-progress time counts
    ]);
  });

  it("shows recurring items on every shown day, each opening its series", async ({ tx }) => {
    await saveSettings(tx);
    const standupId = await insertItem(tx, {
      ...fixed("Standup", utc("2026-10-05T17:00", "2026-10-05T17:30")), // 13:00–13:30
      recurrence: daily,
    });
    const oldClub = {
      ...fixed("Old club", utc("2026-09-01T22:00", "2026-09-01T23:00")), // 18:00–19:00
      recurrence: { ...daily, until: "2026-09-30" },
    };
    const oldClubId = await insertItem(tx, oldClub);
    const gym = { ...flexible("Gym", 60, utc("2026-10-05T14:00", "2026-10-06T14:00")), recurrence: daily };
    const gymId = await insertItem(tx, gym);
    // Tuesday's gym started this morning, before it was edited to miss Tuesdays; it still shows under the series.
    const lecture = {
      ...flexible("Lecture prep", 60, utc("2026-10-05T14:00", "2026-10-07T14:00")),
      recurrence: { frequency: "weekly", interval: 1, weekdays: [1, 3], until: null } satisfies Recurrence,
    };
    const lectureId = await insertItem(tx, lecture);
    await insertPlacements(tx, [auto(`${lectureId}@2026-10-06`, utc("2026-10-06T14:00", "2026-10-06T15:00"))]);

    const calendar = await loadCalendar(tx, wednesdayNoon);
    const standups = calendar!.blocks.filter((block) => block.title === "Standup");

    // Shown for the whole week, past the plan, each from its own occurrence.
    expect(standups.map((block) => block.target.occurrenceDate)).toEqual(calendar!.weekDates);
    expect(standups[0].target.item).toMatchObject({ id: standupId, start: new Date("2026-10-07T17:00Z") });

    // The edit form opens a series at its next occurrence: today's gym window started at 10:00.
    expect(calendar!.blocks.find((block) => block.title === "Gym")?.target.item).toEqual({
      ...gym,
      id: gymId,
      earliestStart: new Date("2026-10-07T14:00Z"),
      deadline: new Date("2026-10-08T14:00Z"),
    });
    expect(
      calendar!.blocks.find((block) => block.date === "2026-10-06" && block.title === "Lecture prep")?.target,
    ).toMatchObject({ item: { id: lectureId }, occurrenceDate: "2026-10-06" });

    // A series that has ended opens as saved.
    const lastWeek = await loadCalendar(tx, wednesdayNoon, Temporal.PlainDate.from("2026-09-29"));
    expect(lastWeek!.blocks.find((block) => block.title === "Old club")?.target.item).toEqual({
      ...oldClub,
      id: oldClubId,
    });
  });

  it("reports each shown day's fixed items and blocks against its focus cap, counting overlaps once and missed blocks not at all", async ({
    tx,
  }) => {
    await saveSettings(tx);
    await tx.update(settings).set({ focusCapsMin: [null, null, 180, null, null, null, null] });
    await insertItem(tx, fixed("Lecture", utc("2026-10-07T17:00", "2026-10-07T18:00"))); // Wed 13:00–14:00
    await insertItem(tx, fixed("Office hours", utc("2026-10-07T17:30", "2026-10-07T18:30"))); // Wed 13:30–14:30
    const readingId = await insertItem(tx, flexible("Reading", 60, utc("2026-10-05T04:00", "2026-10-09T21:00")));
    const notesId = await insertItem(tx, flexible("Notes", 60, utc("2026-10-05T04:00", "2026-10-06T21:00"))); // due Tue
    await insertPlacements(tx, [
      { ...auto(readingId, utc("2026-10-07T14:00", "2026-10-07T15:00")), status: "done" }, // Wed 10:00–11:00
      { ...auto(notesId, utc("2026-10-06T14:00", "2026-10-06T15:00")), status: "missed" }, // Tue
    ]);

    const calendar = await loadCalendar(tx, wednesdayNoon);

    expect(Object.keys(calendar!.loads)).toEqual(calendar!.weekDates);
    expect(calendar?.loads["2026-10-07"]).toEqual({ usedMin: 150, capMin: 180 });
    expect(calendar?.loads["2026-10-06"]).toEqual({ usedMin: 0, capMin: null });
    expect(calendar?.focusCaps).toEqual([null, null, 180, null, null, null, null]);
  });
});
