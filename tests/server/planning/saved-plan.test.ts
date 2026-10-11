import { describe, expect } from "vitest";
import { nightly } from "@/lib/downtime";
import { loadCalendar } from "@/server/calendar";
import { insertItem } from "@/server/db/items-repository";
import { settings } from "@/server/db/schema";
import { replanWorkspace } from "@/server/planning/saved-plan";
import { dbTest as it } from "../../support/database";
import { utc } from "../../support/intervals";
import { flexible } from "../../support/items";

const mondayMorning = new Date("2026-10-05T14:00Z"); // Mon Oct 5, 10:00 EDT
const mondayEvening = new Date("2026-10-05T22:00Z"); // 18:00 EDT
const tuesdayMorning = new Date("2026-10-06T14:00Z");
const week = utc("2026-10-05T04:00", "2026-10-10T04:00");

describe("the saved plan", () => {
  it("is planned on a day's first load and after changes, and only read otherwise", async ({ tx }) => {
    await tx.update(settings).set({ timeZone: "America/New_York", downtime: nightly(23 * 60, 10 * 60) });
    const planned = async (now: Date) => {
      const calendar = await loadCalendar(tx, now);
      return {
        blocks: new Set(calendar.blocks.map((block) => block.title)),
        queue: calendar.queue.map((t) => t.title),
      };
    };
    await insertItem(tx, flexible("Essay", 60, week));
    await insertItem(tx, flexible("Marathon", 24 * 60, week)); // longer than any free stretch

    expect(await planned(mondayMorning)).toEqual({ blocks: new Set(["Essay"]), queue: ["Marathon"] });

    // Saved without planning, as no action would: a load the same day only reads the plan.
    await insertItem(tx, flexible("Reading", 30, week));
    expect((await planned(mondayEvening)).blocks.has("Reading")).toBe(false);

    await replanWorkspace(tx, mondayEvening);
    expect((await planned(mondayEvening)).blocks.has("Reading")).toBe(true);

    await insertItem(tx, flexible("Slides", 30, week));
    expect(await planned(tuesdayMorning)).toEqual({
      blocks: new Set(["Essay", "Reading", "Slides"]),
      queue: ["Marathon"],
    });
  });
});
