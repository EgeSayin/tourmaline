import "server-only";
import { desc, eq, lte } from "drizzle-orm";
import { db } from "@/server/db/client";
import { inPlanTransaction } from "@/server/db/plan-lock";
import { insertCategory } from "@/server/db/categories-repository";
import { insertItem, loadItems } from "@/server/db/items-repository";
import { categories, items, placements, settings } from "@/server/db/schema";
import { syncPlan } from "@/server/planning/sync-plan";
import { weekContaining } from "@/server/time/days";
import { sampleWeek } from "./sample-week";

/**
 * Replaces all items, categories and settings with the sample week for the current week, planned from the week's start, with
 * the placements that ended before now checked off as done, but for one to review and one missed.
 */
async function seed() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a production database");

  const now = new Date();
  const sample = sampleWeek(now);
  const settingsRow = {
    timeZone: sample.settings.timeZone,
    downtimeStartMinute: sample.settings.downtime.startMinute,
    downtimeEndMinute: sample.settings.downtime.endMinute,
    focusCapsMin: sample.settings.focusCaps,
  };

  const plan = await inPlanTransaction(db, async (tx) => {
    await tx.delete(items);
    await tx.delete(categories);
    await tx.insert(settings).values(settingsRow).onConflictDoUpdate({ target: settings.id, set: settingsRow });
    const categoryIds = new Map<string, string>();
    for (const [key, category] of Object.entries(sample.categories)) {
      categoryIds.set(key, await insertCategory(tx, category));
    }
    for (const item of [...sample.fixedItems, ...sample.tasks]) {
      await insertItem(tx, { ...item, categoryId: item.categoryId && categoryIds.get(item.categoryId)! });
    }

    const weekStart = weekContaining(now, sample.settings.timeZone).range.start;
    const plan = await syncPlan(tx, await loadItems(tx), sample.settings, weekStart);
    await tx.update(placements).set({ status: "done" }).where(lte(placements.endAt, now));
    // Show the review list and a missed block: the latest past block is left to review, the one before is missed.
    const [toReview, missed] = await tx
      .select({ id: placements.id })
      .from(placements)
      .where(lte(placements.endAt, now))
      .orderBy(desc(placements.endAt))
      .limit(2);
    if (toReview) await tx.update(placements).set({ status: "planned" }).where(eq(placements.id, toReview.id));
    if (missed) await tx.update(placements).set({ status: "missed" }).where(eq(placements.id, missed.id));
    return plan;
  });

  console.log(
    `Seeded ${sample.fixedItems.length} fixed items and ${sample.tasks.length} tasks, ` +
      `${plan.placements.length} placements.`,
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
