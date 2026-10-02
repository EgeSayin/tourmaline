import "server-only";
import type { FixedItem, FlexibleItem } from "@/lib/items";
import { localDatesInRange } from "@/lib/local-time";
import type { Placement } from "@/lib/placements";
import type { TimeZone } from "@/lib/time-zone";
import type { Database, Transaction } from "@/server/db/connection";
import { loadItems } from "@/server/db/items-repository";
import { loadSettings } from "@/server/db/settings-repository";
import type { Interval } from "@/server/scheduler/intervals";
import { schedule } from "@/server/scheduler/schedule";
import { weekContaining } from "@/server/week";

export interface WeekSchedule {
  timeZone: TimeZone;
  range: Interval;
  /** Local dates of the week, Monday first. */
  dates: string[];
  fixedItems: FixedItem[];
  flexibleItems: FlexibleItem[];
  placements: Placement[];
  unplaced: FlexibleItem[];
}

/** Loads settings and items and schedules the week containing `now`; `null` if no settings are saved yet. */
export async function loadWeekSchedule(
  executor: Database | Transaction,
  now: Temporal.Instant,
): Promise<WeekSchedule | null> {
  const [settings, items] = await Promise.all([loadSettings(executor), loadItems(executor)]);
  if (!settings) return null;

  const { range } = weekContaining(now, settings.timeZone);
  const fixedItems = items.filter((item): item is FixedItem => item.timing === "fixed");
  const flexibleItems = items.filter((item): item is FlexibleItem => item.timing === "flexible");
  const { placements, unplaced } = schedule(range, fixedItems, flexibleItems, settings);

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
