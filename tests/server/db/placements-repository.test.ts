import { describe, expect } from "vitest";
import { deleteItem, insertItem, loadItem } from "@/server/db/items-repository";
import fc from "fast-check";
import { isPending, PLACEMENT_STATUSES, type Placement, placementState } from "@/lib/placements";
import { overlaps } from "@/lib/time/interval";
import {
  deletePendingPlacements,
  insertPlacements,
  loadItemPlacements,
  loadPlacements,
  loadPlacementsToReview,
} from "@/server/db/placements-repository";
import { placements } from "@/server/db/schema";
import { dbTest as it, savepoint } from "../../support/database";
import { flexible } from "../../support/items";
import { intervalArb, utc } from "../../support/intervals";

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

  it("selects in SQL exactly what the TypeScript predicates say: pending, to review, and overlapping", async ({
    tx,
  }) => {
    const essayId = await insertItem(tx, flexible("Essay", 60, week));
    const placementsArb = fc.uniqueArray(
      fc
        .tuple(intervalArb(), fc.boolean(), fc.constantFrom(...PLACEMENT_STATUSES))
        .map(([times, pinned, status]): Placement => ({ taskId: essayId, ...times, pinned, status })),
      { selector: (placement) => placement.start.getTime(), maxLength: 8 },
    );
    const sorted = (list: Placement[]) => [...list].sort((a, b) => a.start.getTime() - b.start.getTime());

    // Times are often a block's own start or end, where the predicates' boundaries are.
    const scenarioArb = placementsArb.chain((saved) => {
      const timeArb = fc.oneof(
        intervalArb().map(({ start }) => start),
        ...(saved.length > 0
          ? [{ arbitrary: fc.constantFrom(...saved.flatMap(({ start, end }) => [start, end])), weight: 4 }]
          : []),
      );
      return fc.tuple(fc.constant(saved), timeArb, timeArb);
    });

    await fc.assert(
      fc.asyncProperty(scenarioArb, async ([saved, now, other]) => {
        await insertPlacements(tx, saved);
        const range = now < other ? { start: now, end: other } : { start: other, end: now };

        expect(await loadPlacements(tx, range)).toEqual(sorted(saved.filter((p) => overlaps(p, range))));
        expect(await loadPlacementsToReview(tx, now)).toEqual(
          sorted(saved.filter((p) => placementState(p, now) === "to-review")),
        );
        await deletePendingPlacements(tx, essayId, now);
        expect(await loadItemPlacements(tx, essayId)).toEqual(sorted(saved.filter((p) => !isPending(p, now))));

        await tx.delete(placements);
      }),
      { numRuns: 200 },
    );
  });
});
