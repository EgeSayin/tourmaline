import { describe, expect } from "vitest";
import type { Placement } from "@/lib/placements";
import { insertItem } from "@/server/db/items-repository";
import { insertPlacements, loadPlacement } from "@/server/db/placements-repository";
import { setPlacementPinned, setPlacementStatus } from "@/server/items/placement-commands";
import { dbTest as it, savepoint } from "../../support/database";
import { utc } from "../../support/intervals";
import { flexible } from "../../support/items";

const now = new Date("2026-10-07T16:00Z");

describe("placement commands", () => {
  it("checks off, misses and replans blocks, and pins only planned ones that haven't ended", async ({ tx }) => {
    const essayId = await insertItem(tx, flexible("Essay", 120, utc("2026-10-05T04:00", "2026-10-09T21:00")));
    const block = (start: string, end: string): Placement => ({
      taskId: essayId,
      ...utc(start, end),
      pinned: false,
      status: "planned",
    });
    const past = block("2026-10-07T14:00", "2026-10-07T15:00"); // ended before now
    const future = block("2026-10-08T14:00", "2026-10-08T15:00");
    await insertPlacements(tx, [past, future]);
    const stored = async (placement: Placement) => (await loadPlacement(tx, placement))!;

    for (const status of ["done", "missed", "planned"] as const) {
      expect(await setPlacementStatus(tx, past, status, now)).toBe(true);
      expect((await stored(past)).status).toBe(status);
    }
    await expect(savepoint(tx, (inner) => setPlacementStatus(inner, future, "missed", now))).rejects.toThrow();
    expect(await setPlacementStatus(tx, future, "done", now)).toBe(true); // done early

    await expect(savepoint(tx, (inner) => setPlacementPinned(inner, future, true, now))).rejects.toThrow(); // done
    await setPlacementStatus(tx, future, "planned", now);
    expect(await setPlacementPinned(tx, future, true, now)).toBe(true);
    expect((await stored(future)).pinned).toBe(true);
    expect(await setPlacementPinned(tx, future, false, now)).toBe(true);
    expect((await stored(future)).pinned).toBe(false);
    await expect(savepoint(tx, (inner) => setPlacementPinned(inner, past, true, now))).rejects.toThrow(); // ended

    const nowhere = { taskId: essayId, start: new Date("2026-10-08T09:00Z") };
    expect(await setPlacementStatus(tx, nowhere, "done", now)).toBe(false);
    expect(await setPlacementPinned(tx, nowhere, true, now)).toBe(false);
  });
});
