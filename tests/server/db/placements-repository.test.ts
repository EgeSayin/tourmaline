import { describe, expect } from "vitest";
import { deleteItem, insertItem, loadItem } from "@/server/db/items-repository";
import { insertPlacements, loadPlacements } from "@/server/db/placements-repository";
import { dbTest as it, savepoint } from "../../support/database";
import { flexible } from "../../support/items";
import { utc } from "../../support/intervals";

const week = utc("2026-10-05T04:00", "2026-10-12T04:00");

describe("placements repository", () => {
  it("allows one placement per task and start, and removes them with their task", async ({ tx }) => {
    const essayId = await insertItem(tx, flexible("Essay", 60, week));
    const slot = {
      ...utc("2026-10-06T14:00", "2026-10-06T15:00"),
      pinned: false,
      status: "planned" as const,
    };

    await insertPlacements(tx, [{ taskId: essayId, ...slot }]);
    await expect(savepoint(tx, (nested) => insertPlacements(nested, [{ taskId: essayId, ...slot }]))).rejects.toThrow(); // one per task and start
    await deleteItem(tx, (await loadItem(tx, essayId))!);
    expect(await loadPlacements(tx, week)).toEqual([]);
  });
});
