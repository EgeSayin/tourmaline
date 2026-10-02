import "server-only";
import type { FixedItem, FlexibleItem } from "@/lib/items";
import { localDatesInRange } from "@/lib/local-time";
import type { Placement } from "@/lib/placements";
import type { TimeZone } from "@/lib/time-zone";
import type { Database, Transaction } from "@/server/db/connection";
import { loadItems } from "@/server/db/items-repository";
import { loadPlacements, replacePendingPlacements } from "@/server/db/placements-repository";
import { loadSettings } from "@/server/db/settings-repository";
import type { Interval } from "@/server/scheduler/intervals";
import { replan } from "@/server/scheduler/replan";
import { weekContaining } from "@/server/week";

export interface WeekSchedule {
  timeZone: TimeZone;
  range: Interval;
  /** Local dates of the week, Monday first. */
  dates: string[];
  fixedItems: FixedItem[];
  flexibleItems: FlexibleItem[];
  /** Sorted by start. */
  placements: Placement[];
  /** Tasks whose remaining time doesn't fit this week; `durationMin` is the remaining time. */
  unplaced: FlexibleItem[];
}

/**
 * Loads the week containing `now`, re-plans it from `now` on around its saved placements, and saves the plan
 * if it changed. Re-planning an unchanged plan changes nothing, so repeated loads don't write.
 * `null` if no settings are saved yet.
 */
export async function loadWeekSchedule(
  executor: Database | Transaction,
  now: Temporal.Instant,
): Promise<WeekSchedule | null> {
  const [settings, items] = await Promise.all([loadSettings(executor), loadItems(executor)]);
  if (!settings) return null;

  const { range } = weekContaining(now, settings.timeZone);
  const fixedItems = items.filter((item): item is FixedItem => item.timing === "fixed");
  const flexibleItems = items.filter((item): item is FlexibleItem => item.timing === "flexible");
  const nowDate = new Date(now.epochMilliseconds);

  const existing = await loadPlacements(executor, range);
  const { placements, unplaced } = replan({ range, now: nowDate, fixedItems, flexibleItems, existing, settings });

  const pending = (list: Placement[]) => list.filter((p) => !p.pinned && p.start >= nowDate);
  if (!samePlacements(pending(existing), pending(placements))) {
    await executor.transaction((tx) => replacePendingPlacements(tx, range, nowDate, placements));
  }

  return {
    timeZone: settings.timeZone,
    range,
    dates: localDatesInRange(range, settings.timeZone),
    fixedItems,
    flexibleItems,
    placements,
    unplaced,
  };
}

/** Whether both lists, each sorted by start, hold the same placements. */
function samePlacements(a: Placement[], b: Placement[]): boolean {
  const key = (p: Placement) => `${p.itemId}|${p.start.getTime()}|${p.end.getTime()}|${p.source}|${p.pinned}`;
  return a.length === b.length && a.every((placement, i) => key(placement) === key(b[i]));
}
