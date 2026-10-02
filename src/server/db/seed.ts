import "server-only";
import { sampleWeek } from "@/server/demo/sample-week";
import { db } from "./client";
import { insertItem } from "./items-repository";
import { items, settings } from "./schema";

/** Replaces all items and settings with the sample week. */
async function seed() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a production database");

  const sample = sampleWeek();
  const settingsRow = {
    timeZone: sample.settings.timeZone,
    downtimeStartMinute: sample.settings.downtime.startMinute,
    downtimeEndMinute: sample.settings.downtime.endMinute,
  };
  const all = [...sample.fixedItems, ...sample.flexibleItems];

  await db.transaction(async (tx) => {
    await tx.delete(items);
    await tx.insert(settings).values(settingsRow).onConflictDoUpdate({ target: settings.id, set: settingsRow });
    for (const item of all) await insertItem(tx, item);
  });

  console.log(`Seeded ${sample.fixedItems.length} fixed and ${sample.flexibleItems.length} flexible items.`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
