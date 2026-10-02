import "server-only";
import type { FixedItem, FlexibleItem } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import type { TimeZone } from "@/lib/time-zone";
import type { Database, Transaction } from "@/server/db/connection";
import { loadItems } from "@/server/db/items-repository";
import { loadPlacements, replacePendingPlacements } from "@/server/db/placements-repository";
import { loadSettings } from "@/server/db/settings-repository";
import { planningHorizon } from "@/server/scheduler/horizon";
import { replan } from "@/server/scheduler/replan";
import { toDate } from "@/server/temporal";
import { daysFrom, PHONE_DAY_COUNT, weekOf } from "@/server/week";

export interface WeekSchedule {
  timeZone: TimeZone;
  /** Local dates of the week containing the shown date, Monday first. */
  weekDates: string[];
  /** Local dates of the `PHONE_DAY_COUNT` days starting on the shown date. */
  dayDates: string[];
  /** Local date of `now`. */
  today: string;
  fixedItems: FixedItem[];
  flexibleItems: FlexibleItem[];
  /** Placements overlapping the week or the days, sorted by start. */
  placements: Placement[];
  /** Tasks due after now whose remaining time doesn't fit before their deadline; `durationMin` is the remaining time. */
  unplaced: FlexibleItem[];
}

/**
 * Re-plans from `now` to the latest item date around the saved placements, saves the plan if it changed, and
 * returns the week and the `PHONE_DAY_COUNT` days from `shownDate` (default: today). Placements before `now` count
 * toward each task's time. Re-planning an unchanged plan changes nothing, so repeated loads don't write.
 * `null` if no settings are saved yet.
 */
export async function loadWeekSchedule(
  executor: Database | Transaction,
  now: Temporal.Instant,
  shownDate?: Temporal.PlainDate,
): Promise<WeekSchedule | null> {
  const [settings, items] = await Promise.all([loadSettings(executor), loadItems(executor)]);
  if (!settings) return null;

  const today = now.toZonedDateTimeISO(settings.timeZone).toPlainDate();
  const week = weekOf(shownDate ?? today, settings.timeZone);
  const days = daysFrom(shownDate ?? today, PHONE_DAY_COUNT, settings.timeZone);
  const shown = { start: week.range.start, end: days.range.end > week.range.end ? days.range.end : week.range.end };
  const fixedItems = items.filter((item): item is FixedItem => item.timing === "fixed");
  const flexibleItems = items.filter((item): item is FlexibleItem => item.timing === "flexible");
  const nowDate = toDate(now);
  const horizon = planningHorizon(nowDate, items);

  const existing = await loadPlacements(executor, { start: new Date(0), end: horizon.end });
  const { placements, unplaced } = replan({
    range: horizon,
    now: nowDate,
    fixedItems,
    flexibleItems,
    existing,
    settings,
  });

  const pending = (list: Placement[]) => list.filter((p) => !p.pinned && p.start >= nowDate);
  if (!samePlacements(pending(existing), pending(placements))) {
    await executor.transaction((tx) => replacePendingPlacements(tx, horizon, nowDate, placements));
  }

  return {
    timeZone: settings.timeZone,
    weekDates: Array.from({ length: 7 }, (_, i) => week.monday.add({ days: i }).toString()),
    dayDates: days.dates,
    today: today.toString(),
    fixedItems,
    flexibleItems,
    placements: placements.filter((p) => p.start < shown.end && p.end > shown.start),
    unplaced: unplaced.filter((task) => task.deadline > nowDate),
  };
}

/** Whether both lists, each sorted by start, hold the same placements. */
function samePlacements(a: Placement[], b: Placement[]): boolean {
  const key = (p: Placement) => `${p.itemId}|${p.start.getTime()}|${p.end.getTime()}|${p.source}|${p.pinned}`;
  return a.length === b.length && a.every((placement, i) => key(placement) === key(b[i]));
}
