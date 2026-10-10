import "server-only";
import { weekContaining } from "@/server/time/days";
import type { Item } from "@/lib/items";
import { occurrenceId, parseOccurrenceId } from "@/lib/recurrence";
import { sampleWeek } from "./sample-week";
import { expandOccurrences } from "@/server/recurrence";
import { freeTimeMap } from "@/server/scheduler/free-time";
import { placeTasks } from "@/server/scheduler/placement";
import { db } from "@/server/db/client";
import { insertItem } from "@/server/db/items-repository";
import { insertPlacements } from "@/server/db/placements-repository";
import { items, settings } from "@/server/db/schema";

/**
 * Replaces all items and settings with the sample week for the current week, planned from the week's start,
 * so placements before now count as done. Recurring items are planned for that week's occurrences.
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
  const { range } = weekContaining(now, sample.settings.timeZone);
  const expand = <T extends Item>(list: T[]) =>
    list.flatMap((item) => expandOccurrences(item, range, sample.settings.timeZone));
  const plan = placeTasks(
    expand(sample.tasks),
    freeTimeMap(range, expand(sample.fixedItems), sample.settings),
    sample.settings.timeZone,
  );

  await db.transaction(async (tx) => {
    await tx.delete(items);
    await tx.insert(settings).values(settingsRow).onConflictDoUpdate({ target: settings.id, set: settingsRow });

    const savedIds = new Map<string, string>();
    for (const item of [...sample.fixedItems, ...sample.tasks]) {
      savedIds.set(item.id, await insertItem(tx, item));
    }
    await insertPlacements(
      tx,
      plan.placements.map((placement) => {
        const { itemId, date } = parseOccurrenceId(placement.taskId);
        const savedId = savedIds.get(itemId)!;
        return { ...placement, taskId: date ? occurrenceId(savedId, date) : savedId };
      }),
    );
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
