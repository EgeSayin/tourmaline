import { describe, expect } from "vitest";
import { insertItem } from "@/server/db/items-repository";
import { settings } from "@/server/db/schema";
import { loadWeekSchedule } from "@/server/week-schedule";
import { dbTest as it } from "../support/database";
import { fixed, flexible } from "../support/items";

const utc = (start: string, end: string) => ({ start: new Date(`${start}Z`), end: new Date(`${end}Z`) });

describe("loadWeekSchedule", { tags: ["integration", "critical"] }, () => {
  it("returns null without settings, otherwise schedules the stored items for the week containing now", async ({
    tx,
  }) => {
    const now = Temporal.Instant.from("2026-10-07T16:00Z"); // Wed Oct 7, 12:00 EDT
    expect(await loadWeekSchedule(tx, now)).toBeNull();

    await tx
      .insert(settings)
      .values({ timeZone: "America/New_York", downtimeStartMinute: 23 * 60, downtimeEndMinute: 10 * 60 });
    await insertItem(tx, fixed("Lecture", utc("2026-10-05T14:00", "2026-10-05T16:00"))); // Mon 10:00–12:00
    const essayId = await insertItem(tx, flexible("Essay", 60, utc("2026-10-05T04:00", "2026-10-06T04:00"))); // due Mon night

    const week = await loadWeekSchedule(tx, now);

    expect(week?.dates).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    expect(week?.fixedItems.map((item) => item.title)).toEqual(["Lecture"]);
    expect(week?.placements).toEqual([
      { itemId: essayId, ...utc("2026-10-05T16:00", "2026-10-05T17:00"), source: "auto", pinned: false }, // right after the lecture
    ]);
    expect(week?.unplaced).toEqual([]);
  });
});
