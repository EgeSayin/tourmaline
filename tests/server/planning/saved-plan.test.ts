import { describe, expect } from "vitest";
import { nightly } from "@/lib/downtime";
import { loadShell, loadWeek } from "@/server/calendar";
import { insertItem } from "@/server/db/items-repository";
import { settings } from "@/server/db/schema";
import { plannedToday, replanWorkspace } from "@/server/planning/saved-plan";
import { dbTest as it } from "../../support/database";
import { utc } from "../../support/intervals";
import { flexible } from "../../support/items";

const mondayMorning = new Date("2026-10-05T14:00Z"); // Mon Oct 5, 10:00 EDT
const mondayLate = new Date("2026-10-06T03:30Z"); // 23:30 EDT, already Tuesday in UTC
const tuesdayMorning = new Date("2026-10-06T14:00Z");
const week = utc("2026-10-05T04:00", "2026-10-10T04:00");

describe("the saved plan", () => {
  it("is read back with its queue, and counts as planned until the local day ends", async ({ tx }) => {
    await tx.update(settings).set({ timeZone: "America/New_York", downtime: nightly(23 * 60, 10 * 60) });
    await insertItem(tx, flexible("Essay", 60, week));
    await insertItem(tx, flexible("Marathon", 24 * 60, week)); // longer than any free stretch
    expect(await plannedToday(tx, mondayMorning)).toBe(false); // never planned

    await replanWorkspace(tx, mondayMorning);

    expect((await loadWeek(tx, mondayLate)).blocks.map((block) => block.title)).toEqual(["Essay"]);
    const { queue } = await loadShell(tx, mondayLate);
    expect(queue.map((task) => [task.title, task.remainingMin])).toEqual([["Marathon", 24 * 60]]);
    expect(await plannedToday(tx, mondayLate)).toBe(true);
    expect(await plannedToday(tx, tuesdayMorning)).toBe(false);
  });
});
