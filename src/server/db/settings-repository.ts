import { sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { SchedulerSettings } from "@/lib/settings";
import { isTimeZone, type TimeZone } from "@/lib/time/time-zone";
import { sameLocalTime } from "@/server/time/temporal";
import { ownedBy, type WorkspaceTx } from "./workspace-transaction";
import { fixedItems, placements, settings, tasks } from "./schema";

export async function loadSettings(tx: WorkspaceTx): Promise<SchedulerSettings> {
  const row = (await tx.query.settings.findFirst({ where: ownedBy(tx, settings) }))!;
  if (!isTimeZone(row.timeZone)) throw new Error(`Unsupported time zone in settings: "${row.timeZone}"`);
  return { timeZone: row.timeZone, downtime: row.downtime, focusCaps: row.focusCapsMin };
}

/** Replaces the settings as they are, without moving items to a new time zone (see `moveToTimeZone`). */
export async function saveSettings(
  tx: WorkspaceTx,
  { timeZone, downtime, focusCaps }: SchedulerSettings,
): Promise<void> {
  await tx.update(settings).set({ timeZone, downtime, focusCapsMin: focusCaps }).where(ownedBy(tx, settings));
}

export async function saveWeekSettings(
  tx: WorkspaceTx,
  { downtime, focusCaps }: Pick<SchedulerSettings, "downtime" | "focusCaps">,
): Promise<void> {
  await tx.update(settings).set({ downtime, focusCapsMin: focusCaps }).where(ownedBy(tx, settings));
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
  // Reinserted rather than updated: shifting rows one by one could briefly clash on a task's unique start.
  const moved = await tx.delete(placements).where(ownedBy(tx, placements)).returning();
  if (moved.length > 0) {
    await tx.insert(placements).values(
      moved.map((placement) => ({
        ...placement,
        startAt: sameLocalTime(placement.startAt, from, timeZone),
        endAt: sameLocalTime(placement.endAt, from, timeZone),
      })),
    );
  }
  await tx.update(settings).set({ timeZone }).where(ownedBy(tx, settings));
}
