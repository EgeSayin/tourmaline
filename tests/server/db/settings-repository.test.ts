import { describe, expect } from "vitest";
import { isFixed } from "@/lib/items";
import { insertItem, loadItems } from "@/server/db/items-repository";
import { insertPlacements, loadTaskPlacements } from "@/server/db/placements-repository";
import { settings } from "@/server/db/schema";
import { loadSettings, moveToTimeZone } from "@/server/db/settings-repository";
import { dbTest as it } from "../../support/database";
import { utc } from "../../support/intervals";
import { fixed, flexible } from "../../support/items";

describe("moveToTimeZone", () => {
  it("keeps every item's and block's local times, even when blocks swap starts", async ({ tx }) => {
    await tx.update(settings).set({ timeZone: "America/New_York" });
    await insertItem(tx, fixed("Lecture", utc("2026-10-07T13:00", "2026-10-07T14:00"))); // 09:00 EDT
    const taskId = await insertItem(tx, flexible("Essay", 60, utc("2026-10-05T14:00", "2026-10-09T21:00")));
    // Moving to UTC shifts both 4 hours earlier: the later block lands on the earlier one's start.
    await insertPlacements(tx, [
      { taskId, ...utc("2026-10-06T14:00", "2026-10-06T14:30"), pinned: true, status: "done" },
      { taskId, ...utc("2026-10-06T18:00", "2026-10-06T18:30"), pinned: false, status: "planned" },
    ]);

    await moveToTimeZone(tx, "UTC");

    expect((await loadSettings(tx)).timeZone).toBe("UTC");
    const [lecture, essay] = (await loadItems(tx)).sort((a) => (isFixed(a) ? -1 : 1));
    expect(lecture).toMatchObject(utc("2026-10-07T09:00", "2026-10-07T10:00"));
    expect(essay).toMatchObject({
      earliestStart: new Date("2026-10-05T10:00Z"),
      deadline: new Date("2026-10-09T17:00Z"),
    });
    expect(await loadTaskPlacements(tx, taskId)).toEqual([
      { taskId, ...utc("2026-10-06T10:00", "2026-10-06T10:30"), pinned: true, status: "done" },
      { taskId, ...utc("2026-10-06T14:00", "2026-10-06T14:30"), pinned: false, status: "planned" },
    ]);
  });
});
