import { describe, expect } from "vitest";
import type { Transaction } from "@/server/db/connection";
import { insertItem } from "@/server/db/items-repository";
import { loadPlacements } from "@/server/db/placements-repository";
import { placements, settings } from "@/server/db/schema";
import { loadWeekSchedule } from "@/server/week-schedule";
import { dbTest as it } from "../support/database";
import { fixed, flexible } from "../support/items";

const utc = (start: string, end: string) => ({ start: new Date(`${start}Z`), end: new Date(`${end}Z`) });
const wednesdayNoon = Temporal.Instant.from("2026-10-07T16:00Z"); // Wed Oct 7, 12:00 EDT
const week = utc("2026-10-05T04:00", "2026-10-12T04:00");
const auto = (itemId: string, times: { start: Date; end: Date }) => ({
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
  it("returns null without settings, otherwise plans the week containing now from now on and saves the plan", async ({
    tx,
  }) => {
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
});
