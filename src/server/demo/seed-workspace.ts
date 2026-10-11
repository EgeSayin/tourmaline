import { and, desc, eq, lte } from "drizzle-orm";
import { insertCategory } from "@/server/db/categories-repository";
import { insertItem, loadItems } from "@/server/db/items-repository";
import { categories, items, placements, settings } from "@/server/db/schema";
import { ownedBy, type WorkspaceTx } from "@/server/db/workspace-transaction";
import { type Plan, syncPlan } from "@/server/planning/sync-plan";
import { weekContaining } from "@/server/time/days";
import { sampleWeek } from "./sample-week";

/**
 * Replaces the workspace's items, categories and settings with the sample week for the current week, planned from
 * the week's start, with the placements that ended before now checked off as done, but for one to review and one
 * missed.
 */
export async function seedWorkspace(tx: WorkspaceTx, now: Date): Promise<Plan> {
  const sample = sampleWeek(now);
  const { timeZone, downtime, focusCaps } = sample.settings;

  await tx.delete(items).where(ownedBy(tx, items));
  await tx.delete(categories).where(ownedBy(tx, categories));
  await tx.update(settings).set({ timeZone, downtime, focusCapsMin: focusCaps }).where(ownedBy(tx, settings));
  const categoryIds = new Map<string, string>();
  for (const [key, category] of Object.entries(sample.categories)) {
    categoryIds.set(key, await insertCategory(tx, category));
  }
  for (const item of [...sample.fixedItems, ...sample.tasks]) {
    await insertItem(tx, { ...item, categoryId: item.categoryId && categoryIds.get(item.categoryId)! });
  }

  const plan = await syncPlan(tx, await loadItems(tx), sample.settings, weekContaining(now, timeZone).range.start);
  const ended = and(ownedBy(tx, placements), lte(placements.endAt, now));
  await tx.update(placements).set({ status: "done" }).where(ended);
  // Show the review list and a missed block: the latest past block is left to review, the one before is missed.
  const [toReview, missed] = await tx
    .select({ id: placements.id })
    .from(placements)
    .where(ended)
    .orderBy(desc(placements.endAt))
    .limit(2);
  if (toReview) await tx.update(placements).set({ status: "planned" }).where(eq(placements.id, toReview.id));
  if (missed) await tx.update(placements).set({ status: "missed" }).where(eq(placements.id, missed.id));
  return plan;
}
