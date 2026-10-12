import { insertCategory } from "@/server/db/categories-repository";
import { insertItem, loadItems } from "@/server/db/items-repository";
import { checkOffEnded, updatePlacement } from "@/server/db/placements-repository";
import { saveSettings } from "@/server/db/settings-repository";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { clearWorkspace } from "@/server/db/workspaces-repository";
import { replanWorkspace } from "@/server/planning/saved-plan";
import { type Plan, syncPlan } from "@/server/planning/sync-plan";
import { sampleWeek } from "./sample-week";

/**
 * Replaces the workspace's items, categories and settings with the sample week around `now`, planned from its start,
 * with the placements that ended before now checked off as done, but for one to review and one
 * missed, then planned again from `now`.
 */
export async function seedWorkspace(tx: WorkspaceTx, now: Date): Promise<Plan> {
  const sample = sampleWeek(now);

  await clearWorkspace(tx);
  await saveSettings(tx, sample.settings);
  const categoryIds = new Map<string, string>();
  for (const [key, category] of Object.entries(sample.categories)) {
    categoryIds.set(key, await insertCategory(tx, category));
  }
  for (const item of [...sample.fixedItems, ...sample.tasks]) {
    await insertItem(tx, { ...item, categoryId: item.categoryId && categoryIds.get(item.categoryId)! });
  }

  const plan = await syncPlan(tx, await loadItems(tx), sample.settings, sample.planFrom);
  await checkOffEnded(tx, now);
  // Show the review list and a missed block: the latest past block is left to review, the one before is missed.
  const [toReview, missed] = plan.placements
    .filter((placement) => placement.end <= now)
    .sort((a, b) => b.end.getTime() - a.end.getTime());
  if (toReview) await updatePlacement(tx, toReview, { status: "planned" });
  if (missed) await updatePlacement(tx, missed, { status: "missed" });
  await replanWorkspace(tx, now);
  return plan;
}
