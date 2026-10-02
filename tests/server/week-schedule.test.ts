import { describe, expect } from "vitest";
import type { Transaction } from "@/server/db/connection";
import { insertItem } from "@/server/db/items-repository";
import { insertPlacements, loadPlacements } from "@/server/db/placements-repository";
import { placements, settings } from "@/server/db/schema";
import { loadWeekSchedule } from "@/server/week-schedule";
import type { Placement } from "@/lib/placements";
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

describe("loadWeekSchedule", { tags: ["integration", "critical"] }, () => {
  it("returns null without settings, otherwise plans from now on and saves the plan", async ({ tx }) => {
    expect(await loadWeekSchedule(tx, wednesdayNoon)).toBeNull();

    await saveSettings(tx);
    await insertItem(tx, fixed("Lecture", utc("2026-10-07T17:00", "2026-10-07T18:00"))); // Wed 13:00–14:00
    const essayId = await insertItem(tx, flexible("Essay", 90, utc("2026-10-05T04:00", "2026-10-09T21:00"))); // due Fri
    const lateId = await insertItem(tx, flexible("Late reading", 30, utc("2026-10-05T04:00", "2026-10-06T04:00"))); // due Mon

    const schedule = await loadWeekSchedule(tx, wednesdayNoon);

    expect(schedule?.dates).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    expect(schedule?.fixedItems.map((item) => item.title)).toEqual(["Lecture"]);
    expect(schedule?.placements).toEqual([auto(essayId, utc("2026-10-07T18:00", "2026-10-07T19:30"))]); // after the lecture
    expect(schedule?.today).toBe("2026-10-07");
    expect(schedule?.unplaced.map((task) => task.id)).toEqual([lateId]); // its deadline has passed
    expect(await loadPlacements(tx, week)).toEqual(schedule?.placements);
  });

  it("keeps the saved plan when reloading, adding a task that fits, or as time passes", async ({ tx }) => {
    await saveSettings(tx);
    const essayId = await insertItem(tx, flexible("Essay", 90, utc("2026-10-05T04:00", "2026-10-09T21:00")));
    const first = await loadWeekSchedule(tx, wednesdayNoon);
    expect(first?.placements).toEqual([auto(essayId, utc("2026-10-07T16:00", "2026-10-07T17:30"))]);

    const savedIds = async () => (await tx.select({ id: placements.id }).from(placements)).map((row) => row.id);
    const idsBefore = await savedIds();
    expect((await loadWeekSchedule(tx, wednesdayNoon))?.placements).toEqual(first?.placements);
    expect(await savedIds()).toEqual(idsBefore); // nothing rewritten

    const readingId = await insertItem(tx, flexible("Reading", 30, utc("2026-10-05T04:00", "2026-10-09T21:00")));
    const withReading = await loadWeekSchedule(tx, wednesdayNoon);
    expect(withReading?.placements).toEqual([
      ...first!.placements,
      auto(readingId, utc("2026-10-07T17:30", "2026-10-07T18:00")),
    ]);

    // Half an hour into the essay, both placements stay where they are.
    const later = await loadWeekSchedule(tx, Temporal.Instant.from("2026-10-07T16:30Z"));
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

    const lastWeek = await loadWeekSchedule(tx, wednesdayNoon, Temporal.PlainDate.from("2026-10-01"));
    expect(lastWeek?.dates[0]).toBe("2026-09-28");
    expect(lastWeek?.today).toBe("2026-10-07");
    expect(lastWeek?.placements).toEqual([lastWeekEssay]);
    expect(lastWeek?.unplaced).toEqual([]);
    // The hour done last week counts, so only 30 minutes remain.
    expect(await loadPlacements(tx, week)).toEqual([auto(essayId, utc("2026-10-07T16:00", "2026-10-07T16:30"))]);

    // A task added later, due after everything else, is planned next week and saved there.
    const nextMonday = Temporal.PlainDate.from("2026-10-12");
    expect((await loadWeekSchedule(tx, wednesdayNoon, nextMonday))?.placements).toEqual([]);
    const projectId = await insertItem(tx, flexible("Project", 60, utc("2026-10-12T14:00", "2026-10-16T21:00")));
    const nextWeek = await loadWeekSchedule(tx, wednesdayNoon, nextMonday);
    expect(nextWeek?.dates[0]).toBe("2026-10-12");
    const projectPlacement = auto(projectId, utc("2026-10-12T14:00", "2026-10-12T15:00")); // Mon 10:00
    expect(nextWeek?.placements).toEqual([projectPlacement]);
    expect(await loadPlacements(tx, utc("2026-10-12T04:00", "2026-10-19T04:00"))).toEqual([projectPlacement]);
  });
});
