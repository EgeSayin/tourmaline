import { describe, expect } from "vitest";
import { deleteItem, insertItem } from "@/server/db/items-repository";
import { insertPlacements, loadPlacements } from "@/server/db/placements-repository";
import { dbTest as it } from "../../support/database";
import { fixed, flexible } from "../../support/items";
import { utc } from "../../support/intervals";

const week = utc("2026-10-05T04:00", "2026-10-12T04:00");

describe("placements repository", () => {
  it("only allows placements for flexible tasks, one per start, and removes them with their task", async ({ tx }) => {
    const lectureId = await insertItem(tx, fixed("Lecture", utc("2026-10-05T14:00", "2026-10-05T15:00")));
    const essayId = await insertItem(tx, flexible("Essay", 60, week));
    const slot = {
      ...utc("2026-10-06T14:00", "2026-10-06T15:00"),
      pinned: false,
      status: "planned" as const,
    };

    await expect(
      tx.transaction((nested) => insertPlacements(nested, [{ taskId: lectureId, ...slot }])),
    ).rejects.toThrow();

    await insertPlacements(tx, [{ taskId: essayId, ...slot }]);
    await expect(
      tx.transaction((nested) => insertPlacements(nested, [{ taskId: essayId, ...slot }])),
    ).rejects.toThrow(); // one per task and start
    await deleteItem(tx, essayId);
    expect(await loadPlacements(tx, week)).toEqual([]);
  });
});
