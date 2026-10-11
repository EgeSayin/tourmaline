import { sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { SchedulerSettings } from "@/lib/settings";
import { isTimeZone, type TimeZone } from "@/lib/time/time-zone";
import { sameLocalTime } from "@/server/time/temporal";
import type { Executor } from "./connection";
import { items, placements, settings } from "./schema";

export async function loadSettings(executor: Executor): Promise<SchedulerSettings> {
  const row = (await executor.query.settings.findFirst())!;
  if (!isTimeZone(row.timeZone)) throw new Error(`Unsupported time zone in settings: "${row.timeZone}"`);
  return { timeZone: row.timeZone, downtime: row.downtime, focusCaps: row.focusCapsMin };
}

export async function saveWeekSettings(
  executor: Executor,
  { downtime, focusCaps }: Pick<SchedulerSettings, "downtime" | "focusCaps">,
): Promise<void> {
  await executor.update(settings).set({ downtime, focusCapsMin: focusCaps });
}

/** Switches to `timeZone`, keeping every item's and block's local date and time: a 09:00 class stays at 09:00. */
export async function moveToTimeZone(executor: Executor, timeZone: TimeZone): Promise<void> {
  const { timeZone: from } = await loadSettings(executor);
  const shift = (column: PgColumn) => sql`(${column} at time zone ${from}) at time zone ${timeZone}`;
  await executor.update(items).set({
    startAt: shift(items.startAt),
    endAt: shift(items.endAt),
    earliestStart: shift(items.earliestStart),
    deadline: shift(items.deadline),
  });
  // Reinserted rather than updated: shifting rows one by one could briefly clash on a task's unique start.
  const moved = await executor.delete(placements).returning();
  if (moved.length > 0) {
    await executor.insert(placements).values(
      moved.map((placement) => ({
        ...placement,
        startAt: sameLocalTime(placement.startAt, from, timeZone),
        endAt: sameLocalTime(placement.endAt, from, timeZone),
      })),
    );
  }
  await executor.update(settings).set({ timeZone });
}
