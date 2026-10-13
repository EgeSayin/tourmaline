import type { PlacementRef, PlacementStatus } from "@/lib/placements";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { loadPlacement, updatePlacement } from "@/server/db/placements-repository";

/**
 * Checks off, marks missed or plans again the placement `ref` points to. Only one that has started by `now` can be
 * missed. Returns `false` if there is no such placement.
 */
export async function setPlacementStatus(
  tx: WorkspaceTx,
  ref: PlacementRef,
  status: PlacementStatus,
  now: Date,
): Promise<boolean> {
  const placement = await loadPlacement(tx, ref);
  if (!placement) return false;
  if (status === "missed" && placement.start > now) throw new Error("Only a started placement can be missed");

  await updatePlacement(tx, ref, { status });
  return true;
}

/**
 * Pins or unpins the placement `ref` points to. Only a planned one that hasn't ended by `now` can be pinned.
 * Returns `false` if there is no such placement.
 */
export async function setPlacementPinned(
  tx: WorkspaceTx,
  ref: PlacementRef,
  pinned: boolean,
  now: Date,
): Promise<boolean> {
  const placement = await loadPlacement(tx, ref);
  if (!placement) return false;
  if (pinned && (placement.status !== "planned" || placement.end <= now)) {
    throw new Error("Only a planned placement that hasn't ended can be pinned");
  }

  await updatePlacement(tx, ref, { pinned });
  return true;
}
