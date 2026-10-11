import "server-only";
import { lte } from "drizzle-orm";
import { db } from "@/server/db/client";
import { insertItem, loadItems } from "@/server/db/items-repository";
import { items, placements, settings } from "@/server/db/schema";
import { syncPlan } from "@/server/planning/sync-plan";
import { weekContaining } from "@/server/time/days";
import { sampleWeek } from "./sample-week";

/**
 * Replaces all items and settings with the sample week for the current week, planned from the week's start, with
 * the placements that ended before now checked off as done.
 */
async function seed() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a production database");

  const now = new Date();
  const sample = sampleWeek(now);
  const settingsRow = {
    timeZone: sample.settings.timeZone,
    downtimeStartMinute: sample.settings.downtime.startMinute,
    downtimeEndMinute: sample.settings.downtime.endMinute,
  };

  const plan = await db.transaction(async (tx) => {
    await tx.delete(items);
    await tx.insert(settings).values(settingsRow).onConflictDoUpdate({ target: settings.id, set: settingsRow });
    for (const item of [...sample.fixedItems, ...sample.tasks]) await insertItem(tx, item);

    const weekStart = weekContaining(now, sample.settings.timeZone).range.start;
    const plan = await syncPlan(tx, await loadItems(tx), sample.settings, weekStart);
    await tx.update(placements).set({ done: true }).where(lte(placements.endAt, now));
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
