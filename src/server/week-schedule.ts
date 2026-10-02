import "server-only";
import type { FixedItem, FlexibleItem } from "@/lib/items";
import { localDatesInRange } from "@/lib/local-time";
import type { Placement } from "@/lib/placements";
import type { TimeZone } from "@/lib/time-zone";
import type { Database, Transaction } from "@/server/db/connection";
import { loadItems } from "@/server/db/items-repository";
import { loadPlacements, replacePendingPlacements } from "@/server/db/placements-repository";
import { loadSettings } from "@/server/db/settings-repository";
import { planningHorizon } from "@/server/scheduler/horizon";
import type { Interval } from "@/server/scheduler/intervals";
import { replan } from "@/server/scheduler/replan";
import { toDate } from "@/server/temporal";
import { weekContaining, weekOf } from "@/server/week";

export interface WeekSchedule {
  timeZone: TimeZone;
  /** The shown week. */
  range: Interval;
  /** Local dates of the shown week, Monday first. */
  dates: string[];
  /** Local date of `now`. */
  today: string;
  fixedItems: FixedItem[];
  flexibleItems: FlexibleItem[];
  /** Placements in the shown week, sorted by start. */
  placements: Placement[];
  /** Tasks due after now whose remaining time doesn't fit before their deadline; `durationMin` is the remaining time. */
  unplaced: FlexibleItem[];
}

/**
 * Re-plans from `now` to the latest item date around the saved placements, saves the plan if it changed, and
 * returns the week containing `shownDate` (default: the week containing `now`). Placements before `now` count
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

  const shown = shownDate ? weekOf(shownDate, settings.timeZone) : weekContaining(now, settings.timeZone);
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
    range: shown.range,
    dates: localDatesInRange(shown.range, settings.timeZone),
    today: now.toZonedDateTimeISO(settings.timeZone).toPlainDate().toString(),
    fixedItems,
    flexibleItems,
    placements: placements.filter((p) => p.start < shown.range.end && p.end > shown.range.start),
    unplaced: unplaced.filter((task) => task.deadline > nowDate),
  };
}

/** Whether both lists, each sorted by start, hold the same placements. */
function samePlacements(a: Placement[], b: Placement[]): boolean {
  const key = (p: Placement) => `${p.itemId}|${p.start.getTime()}|${p.end.getTime()}|${p.source}|${p.pinned}`;
  return a.length === b.length && a.every((placement, i) => key(placement) === key(b[i]));
}
