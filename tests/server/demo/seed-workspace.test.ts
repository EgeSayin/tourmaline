import { describe, expect } from "vitest";
import { isFixed } from "@/lib/items";
import { loadItems } from "@/server/db/items-repository";
import { loadPlacements } from "@/server/db/placements-repository";
import { seedWorkspace } from "@/server/demo/seed-workspace";
import { weekOf } from "@/server/time/days";
import { localDate } from "@/server/time/temporal";
import { dbTest as it, savepoint } from "../../support/database";
import { utc } from "../../support/intervals";

const timeZone = "America/New_York";

describe("the demo seed", () => {
  it("starts every visitor two days into the sample, with no empty day in today's week, whatever the weekday", async ({
    tx,
  }) => {
    for (let day = 5; day <= 11; day++) {
      const now = new Date(`2026-10-${String(day).padStart(2, "0")}T15:00:00-04:00`);
      const today = localDate(now, timeZone);
      const { items, placements } = await savepoint(tx, async (seeded) => {
        await seedWorkspace(seeded, now);
        return {
          items: await loadItems(seeded),
          placements: await loadPlacements(seeded, utc("2026-09-01T00:00", "2026-11-01T00:00")),
        };
      });

      const dateOf = (time: Date) => localDate(time, timeZone).toString();
      const fixed = items.filter(isFixed);
      const lecture = fixed.find((item) => item.title === "CS 101 lecture")!;
      expect(dateOf(fixed.find((item) => item.title === "Guest talk")!.start)).toBe(today.toString());
      expect(lecture.recurrence).toMatchObject({
        weekdays: [0, 2, 4].map((offset) => today.add({ days: offset - 2 }).dayOfWeek),
      });
      const blockDates = new Set(placements.map((placement) => dateOf(placement.start)));
      for (const date of weekOf(today, timeZone).dates) expect(blockDates).toContain(date);
      const sampleDays = Array.from({ length: 7 }, (_, offset) => today.add({ days: offset - 2 }).toString());
      for (const date of sampleDays) expect(blockDates).toContain(date);
    }
  });
});
