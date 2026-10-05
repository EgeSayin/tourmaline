import { describe, expect } from "vitest";
import type { Transaction } from "@/server/db/connection";
import { insertItem } from "@/server/db/items-repository";
import { insertPlacements, loadPlacements } from "@/server/db/placements-repository";
import { placements, settings } from "@/server/db/schema";
import { loadCalendar } from "@/server/calendar";
import type { Placement } from "@/lib/placements";
import type { Recurrence } from "@/lib/recurrence";
import { dbTest as it } from "../support/database";
import { fixed, flexible } from "../support/items";
import { utc } from "../support/intervals";

const wednesdayNoon = Temporal.Instant.from("2026-10-07T16:00Z"); // Wed Oct 7, 12:00 EDT
const week = utc("2026-10-05T04:00", "2026-10-12T04:00");
const auto = (itemId: string, times: { start: Date; end: Date }): Placement => ({
  itemId,
  ...times,
  source: "auto",
  pinned: false,
});

async function saveSettings(tx: Transaction) {
  await tx
    .insert(settings)
    .values({ timeZone: "America/New_York", downtimeStartMinute: 23 * 60, downtimeEndMinute: 10 * 60 });
}

describe("loadCalendar", { tags: ["integration", "critical"] }, () => {
  it("returns null without settings, otherwise plans from now on and saves the plan", async ({ tx }) => {
    expect(await loadCalendar(tx, wednesdayNoon)).toBeNull();

    await saveSettings(tx);
    await insertItem(tx, fixed("Lecture", utc("2026-10-07T17:00", "2026-10-07T18:00"))); // Wed 13:00–14:00
    const essayId = await insertItem(tx, flexible("Essay", 90, utc("2026-10-05T04:00", "2026-10-09T21:00"))); // due Fri
    await insertItem(tx, flexible("Late reading", 30, utc("2026-10-05T04:00", "2026-10-06T04:00"))); // due Mon
    const marathonId = await insertItem(tx, flexible("Marathon", 24 * 60, utc("2026-10-05T04:00", "2026-10-09T21:00")));

    const schedule = await loadCalendar(tx, wednesdayNoon);

    expect(schedule?.weekDates).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    expect(schedule?.dayDates).toEqual(["2026-10-07", "2026-10-08", "2026-10-09"]); // from today
    expect(schedule?.navigation).toEqual({
      week: { previous: "2026-09-28", next: "2026-10-12", weeksFromToday: 0 },
      days: { previous: "2026-10-04", next: "2026-10-10" },
    });
    expect(schedule?.fixedItems.map((item) => item.title)).toEqual(["Lecture"]);
    expect(schedule?.placements).toEqual([auto(essayId, utc("2026-10-07T18:00", "2026-10-07T19:30"))]); // after the lecture
    expect(schedule?.today).toBe("2026-10-07");
    // No free day is 24 hours long. The late reading doesn't fit either, but its deadline has passed, so it's hidden.
    expect(schedule?.queue).toEqual([{ task: expect.objectContaining({ id: marathonId }), remainingMin: 24 * 60 }]);
    expect(await loadPlacements(tx, week)).toEqual(schedule?.placements);
  });

  it("keeps the saved plan when reloading, adding a task that fits, or as time passes", async ({ tx }) => {
    await saveSettings(tx);
    const essayId = await insertItem(tx, flexible("Essay", 90, utc("2026-10-05T04:00", "2026-10-09T21:00")));
    const first = await loadCalendar(tx, wednesdayNoon);
    expect(first?.placements).toEqual([auto(essayId, utc("2026-10-07T16:00", "2026-10-07T17:30"))]);

    const savedIds = async () => (await tx.select({ id: placements.id }).from(placements)).map((row) => row.id);
    const idsBefore = await savedIds();
    expect((await loadCalendar(tx, wednesdayNoon))?.placements).toEqual(first?.placements);
    expect(await savedIds()).toEqual(idsBefore); // nothing rewritten

    const readingId = await insertItem(tx, flexible("Reading", 30, utc("2026-10-05T04:00", "2026-10-09T21:00")));
    const withReading = await loadCalendar(tx, wednesdayNoon);
    expect(withReading?.placements).toEqual([
      ...first!.placements,
      auto(readingId, utc("2026-10-07T17:30", "2026-10-07T18:00")),
    ]);

    // Half an hour into the essay, both placements stay where they are.
    const later = await loadCalendar(tx, Temporal.Instant.from("2026-10-07T16:30Z"));
    expect(later?.placements).toEqual(withReading?.placements);
    expect(await loadPlacements(tx, week)).toEqual(withReading?.placements);
  });

  it("shows earlier weeks' saved placements and later weeks' planned ones, up to the latest deadline", async ({
    tx,
  }) => {
    await saveSettings(tx);
    const essayId = await insertItem(tx, flexible("Essay", 90, utc("2026-10-05T04:00", "2026-10-09T21:00")));
    const lastWeekEssay = auto(essayId, utc("2026-09-30T14:00", "2026-09-30T15:00")); // Wed Sep 30, 10:00
    await insertPlacements(tx, [lastWeekEssay]);

    const lastWeek = await loadCalendar(tx, wednesdayNoon, Temporal.PlainDate.from("2026-10-01"));
    expect(lastWeek?.weekDates[0]).toBe("2026-09-28");
    expect(lastWeek?.today).toBe("2026-10-07");
    expect(lastWeek?.placements).toEqual([lastWeekEssay]);
    expect(lastWeek?.queue).toEqual([]);
    // The hour done last week counts, so only 30 minutes remain.
    expect(await loadPlacements(tx, week)).toEqual([auto(essayId, utc("2026-10-07T16:00", "2026-10-07T16:30"))]);

    // A task added later, due after everything else, is planned next week and saved there.
    const nextMonday = Temporal.PlainDate.from("2026-10-12");
    expect((await loadCalendar(tx, wednesdayNoon, nextMonday))?.placements).toEqual([]);
    const projectId = await insertItem(tx, flexible("Project", 60, utc("2026-10-12T14:00", "2026-10-16T21:00")));
    const nextWeek = await loadCalendar(tx, wednesdayNoon, nextMonday);
    expect(nextWeek?.weekDates[0]).toBe("2026-10-12");
    const projectPlacement = auto(projectId, utc("2026-10-12T14:00", "2026-10-12T15:00")); // Mon 10:00
    expect(nextWeek?.placements).toEqual([projectPlacement]);
    expect(await loadPlacements(tx, utc("2026-10-12T04:00", "2026-10-19T04:00"))).toEqual([projectPlacement]);

    // Three days from Saturday reach into next week, so its placements come along with the week's.
    const saturday = await loadCalendar(tx, wednesdayNoon, Temporal.PlainDate.from("2026-10-10"));
    expect(saturday?.dayDates).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
    expect(saturday?.placements).toEqual([
      auto(essayId, utc("2026-10-07T16:00", "2026-10-07T16:30")),
      projectPlacement,
    ]);
  });

  it("plans and shows recurring items without letting them extend the plan", async ({ tx }) => {
    await saveSettings(tx);
    const daily: Recurrence = { frequency: "daily", interval: 1, until: null };
    // The plan runs to the essay's deadline, Fri 10:30.
    await insertItem(tx, flexible("Essay", 60, utc("2026-10-05T04:00", "2026-10-09T14:30")));
    const standupId = await insertItem(tx, {
      ...fixed("Standup", utc("2026-10-05T17:00", "2026-10-05T17:30")), // 13:00–13:30
      recurrence: daily,
    });
    // Starts next week; its first occurrence doesn't extend the plan either.
    await insertItem(tx, {
      ...fixed("Seminar", utc("2026-10-12T14:00", "2026-10-12T15:00")),
      recurrence: { frequency: "weekly", interval: 1, weekdays: [1], until: null },
    });
    const gymId = await insertItem(tx, {
      ...flexible("Gym", 60, utc("2026-10-05T14:00", "2026-10-06T14:00")), // 10:00 to 10:00 the next day
      recurrence: daily,
    });

    const schedule = await loadCalendar(tx, wednesdayNoon);
    const weekDates = schedule!.weekDates;

    // Shown for the whole week, past the plan.
    expect(schedule?.fixedItems.map((item) => item.id)).toEqual(weekDates.map((date) => `${standupId}@${date}`));
    expect(schedule?.flexibleItems.map((item) => item.title).sort()).toEqual(["Essay", ...weekDates.map(() => "Gym")]);

    // Planned only while their window overlaps the plan; Friday's runs to Saturday 10:00, so it gets room after 10:30.
    const gymPlacements = schedule!.placements.filter((p) => p.itemId.startsWith(gymId));
    expect(gymPlacements.map((p) => p.itemId)).toEqual(
      ["2026-10-07", "2026-10-08", "2026-10-09"].map((date) => `${gymId}@${date}`),
    );
    expect(gymPlacements.at(-1)!.end > new Date("2026-10-09T14:30Z")).toBe(true);
    expect(schedule?.queue).toEqual([]);

    const standups = schedule!.fixedItems;
    for (const p of schedule!.placements) {
      expect(standups.some((s) => p.start < s.end && p.end > s.start)).toBe(false);
    }
  });
});
