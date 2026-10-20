import type { PlacementRef, PlacementStatus } from "@/lib/placements";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { loadPlacement, updatePlacement } from "@/server/db/placements-repository";

/**
 * Checks off, marks missed or plans again the placement `ref` points to. Only one that has started by `now` can be
 * missed. Returns `false`, changing nothing, if there is no such placement or it can't be missed yet.
 */
export async function setPlacementStatus(
  tx: WorkspaceTx,
  ref: PlacementRef,
  status: PlacementStatus,
  now: Date,
): Promise<boolean> {
  const placement = await loadPlacement(tx, ref);
  if (!placement || (status === "missed" && placement.start > now)) return false;

  await updatePlacement(tx, ref, { status });
  return true;
}

/**
 * Pins or unpins the placement `ref` points to. Only a planned one that hasn't ended by `now` can be pinned.
 * Returns `false`, changing nothing, if there is no such placement or it can't be pinned.
 */
export async function setPlacementPinned(
  tx: WorkspaceTx,
  ref: PlacementRef,
  pinned: boolean,
  now: Date,
): Promise<boolean> {
  const placement = await loadPlacement(tx, ref);
  if (!placement || (pinned && (placement.status !== "planned" || placement.end <= now))) return false;

  await updatePlacement(tx, ref, { pinned });
  return true;
}
