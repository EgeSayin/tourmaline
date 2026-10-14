import { sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { SchedulerSettings } from "@/lib/settings";
import { isTimeZone, type TimeZone } from "@/lib/time/time-zone";
import { ownedBy, type WorkspaceTx } from "./workspace-transaction";
import { fixedItems, placements, settings, tasks } from "./schema";

export async function loadSettings(tx: WorkspaceTx): Promise<SchedulerSettings> {
  const row = (await tx.query.settings.findFirst({ where: ownedBy(tx, settings) }))!;
  if (!isTimeZone(row.timeZone)) throw new Error(`Unsupported time zone in settings: "${row.timeZone}"`);
  return { timeZone: row.timeZone, downtime: row.downtime };
}

/** Replaces the settings as they are, without moving items to a new time zone (see `moveToTimeZone`). */
export async function saveSettings(tx: WorkspaceTx, { timeZone, downtime }: SchedulerSettings): Promise<void> {
  await tx.update(settings).set({ timeZone, downtime }).where(ownedBy(tx, settings));
}

export async function saveDowntime(tx: WorkspaceTx, downtime: SchedulerSettings["downtime"]): Promise<void> {
  await tx.update(settings).set({ downtime }).where(ownedBy(tx, settings));
}

/** Switches to `timeZone`, keeping every item's and block's local date and time: a 09:00 class stays at 09:00. */
export async function moveToTimeZone(tx: WorkspaceTx, timeZone: TimeZone): Promise<void> {
  const { timeZone: from } = await loadSettings(tx);
  const shift = (column: PgColumn) => sql`(${column} at time zone ${from}) at time zone ${timeZone}`;
  await tx
    .update(fixedItems)
    .set({ startAt: shift(fixedItems.startAt), endAt: shift(fixedItems.endAt) })
    .where(ownedBy(tx, fixedItems));
  await tx
    .update(tasks)
    .set({ earliestStart: shift(tasks.earliestStart), deadline: shift(tasks.deadline) })
    .where(ownedBy(tx, tasks));
  await tx
    .update(placements)
    .set({ startAt: shift(placements.startAt), endAt: shift(placements.endAt) })
    .where(ownedBy(tx, placements));
  await tx.update(settings).set({ timeZone }).where(ownedBy(tx, settings));
}
