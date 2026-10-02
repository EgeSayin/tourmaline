import "server-only";
import { sampleWeek } from "@/server/demo/sample-week";
import { schedule } from "@/server/scheduler/schedule";
import { weekContaining } from "@/server/week";
import { db } from "./client";
import { insertItem } from "./items-repository";
import { insertPlacements } from "./placements-repository";
import { items, settings } from "./schema";

/**
 * Replaces all items and settings with the sample week for the current week, planned from the week's start,
 * so placements before now count as done.
 */
async function seed() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a production database");

  const now = Temporal.Now.instant();
  const sample = sampleWeek(now);
  const settingsRow = {
    timeZone: sample.settings.timeZone,
    downtimeStartMinute: sample.settings.downtime.startMinute,
    downtimeEndMinute: sample.settings.downtime.endMinute,
  };
  const { range } = weekContaining(now, sample.settings.timeZone);
  const plan = schedule(range, sample.fixedItems, sample.flexibleItems, sample.settings);

  await db.transaction(async (tx) => {
    await tx.delete(items);
    await tx.insert(settings).values(settingsRow).onConflictDoUpdate({ target: settings.id, set: settingsRow });

    const savedIds = new Map<string, string>();
    for (const item of [...sample.fixedItems, ...sample.flexibleItems]) {
      savedIds.set(item.id, await insertItem(tx, item));
    }
    await insertPlacements(
      tx,
      plan.placements.map((placement) => ({ ...placement, itemId: savedIds.get(placement.itemId)! })),
    );
  });

  console.log(
    `Seeded ${sample.fixedItems.length} fixed and ${sample.flexibleItems.length} flexible items, ` +
      `${plan.placements.length} placements.`,
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
