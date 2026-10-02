import "server-only";
import type { FixedItem, FlexibleItem } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import type { TimeZone } from "@/lib/time-zone";
import {
  type DayNavigation,
  dayNavigation,
  daysFrom,
  PHONE_DAY_COUNT,
  type WeekNavigation,
  weekNavigation,
  weekOf,
} from "@/server/days";
import type { Database, Transaction } from "@/server/db/connection";
import { loadItems } from "@/server/db/items-repository";
import { loadPlacements, replacePendingPlacements } from "@/server/db/placements-repository";
import { loadSettings } from "@/server/db/settings-repository";
import { planningHorizon } from "@/server/scheduler/horizon";
import { replan } from "@/server/scheduler/replan";
import { toDate } from "@/server/temporal";

export interface QueueEntry {
  task: FlexibleItem;
  remainingMin: number;
}

export interface Calendar {
  timeZone: TimeZone;
  /** Local dates of the week containing the shown date, Monday first. */
  weekDates: string[];
  /** Local dates of the `PHONE_DAY_COUNT` days starting on the shown date. */
  dayDates: string[];
  /** Local date of `now`. */
  today: string;
  navigation: { week: WeekNavigation; days: DayNavigation };
  fixedItems: FixedItem[];
  flexibleItems: FlexibleItem[];
  /** Placements overlapping the week or the days, sorted by start. */
  placements: Placement[];
  /** Tasks due after now whose remaining time doesn't fit before their deadline. */
  queue: QueueEntry[];
}

/**
 * Re-plans from `now` to the latest item date around the saved placements, saves the plan if it changed, and
 * returns the week and the `PHONE_DAY_COUNT` days from `shownDate` (default: today). Placements before `now` count
 * toward each task's time. Re-planning an unchanged plan changes nothing, so repeated loads don't write.
 * `null` if no settings are saved yet.
 */
export async function loadCalendar(
  executor: Database | Transaction,
  now: Temporal.Instant,
  shownDate?: Temporal.PlainDate,
): Promise<Calendar | null> {
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
    horizon,
    fixedItems,
    flexibleItems,
    existing,
    settings,
  });

  const pending = (list: Placement[]) => list.filter((p) => !p.pinned && p.start >= nowDate);
  if (!samePlacements(pending(existing), pending(placements))) {
    await executor.transaction((tx) => replacePendingPlacements(tx, horizon, placements));
  }

  return {
    timeZone: settings.timeZone,
    weekDates: week.dates,
    dayDates: days.dates,
    today: today.toString(),
    navigation: {
      week: weekNavigation(week.dates[0], today.toString()),
      days: dayNavigation(days.dates[0], PHONE_DAY_COUNT),
    },
    fixedItems,
    flexibleItems,
    placements: placements.filter((p) => p.start < shown.end && p.end > shown.start),
    queue: unplaced
      .filter((task) => task.deadline > nowDate)
      .map((task) => ({ task: flexibleItems.find((item) => item.id === task.id)!, remainingMin: task.durationMin })),
  };
}

/** Whether both lists, each sorted by start, hold the same placements. */
function samePlacements(a: Placement[], b: Placement[]): boolean {
  const key = (p: Placement) => `${p.itemId}|${p.start.getTime()}|${p.end.getTime()}|${p.source}|${p.pinned}`;
  return a.length === b.length && a.every((placement, i) => key(placement) === key(b[i]));
}
