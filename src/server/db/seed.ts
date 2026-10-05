import "server-only";
import { weekContaining } from "@/server/days";
import type { Item } from "@/lib/items";
import { occurrenceId, parseOccurrenceId } from "@/lib/recurrence";
import { sampleWeek } from "@/server/demo/sample-week";
import { expandOccurrences } from "@/server/recurrence";
import { freeTimeMap } from "@/server/scheduler/free-time";
import { placeTasks } from "@/server/scheduler/schedule";
import { db } from "./client";
import { insertItem } from "./items-repository";
import { insertPlacements } from "./placements-repository";
import { items, settings } from "./schema";

/**
 * Replaces all items and settings with the sample week for the current week, planned from the week's start,
 * so placements before now count as done. Recurring items are planned for that week's occurrences.
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
  const expand = <T extends Item>(list: T[]) =>
    list.flatMap((item) => expandOccurrences(item, range, sample.settings.timeZone) as T[]);
  const plan = placeTasks(expand(sample.flexibleItems), freeTimeMap(range, expand(sample.fixedItems), sample.settings));

  await db.transaction(async (tx) => {
    await tx.delete(items);
    await tx.insert(settings).values(settingsRow).onConflictDoUpdate({ target: settings.id, set: settingsRow });

    const savedIds = new Map<string, string>();
    for (const item of [...sample.fixedItems, ...sample.flexibleItems]) {
      savedIds.set(item.id, await insertItem(tx, item));
    }
    await insertPlacements(
      tx,
      plan.placements.map((placement) => {
        const { itemId, date } = parseOccurrenceId(placement.itemId);
        const savedId = savedIds.get(itemId)!;
        return { ...placement, itemId: date ? occurrenceId(savedId, date) : savedId };
      }),
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
