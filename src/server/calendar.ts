import "server-only";
import { type CalendarBlock, type EditTarget, toCalendarBlocks } from "@/lib/calendar-blocks";
import { isFixed, type Item } from "@/lib/items";
import { parseOccurrenceId } from "@/lib/recurrence";
import { later } from "@/lib/time/interval";
import type { TimeZone } from "@/lib/time/time-zone";
import type { Database, Transaction } from "@/server/db/connection";
import { loadItems } from "@/server/db/items-repository";
import { loadPlacements } from "@/server/db/placements-repository";
import { loadSettings } from "@/server/db/settings-repository";
import { syncPlan } from "@/server/planning/sync-plan";
import { expandOccurrences, nextOccurrence } from "@/server/recurrence";
import {
  type DayNavigation,
  dayNavigation,
  daysFrom,
  PHONE_DAY_COUNT,
  type WeekNavigation,
  weekNavigation,
  weekOf,
} from "@/server/time/days";
import { localDate } from "@/server/time/temporal";

export interface QueueEntry {
  /** Unique among the entries. */
  key: string;
  title: string;
  remainingMin: number;
  deadline: Date;
  target: EditTarget;
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
  /** Fixed items, fixed occurrences and placements overlapping the week or the days. */
  blocks: CalendarBlock[];
  /** Planned tasks due after now whose remaining time doesn't fit before their deadline. */
  queue: QueueEntry[];
}

/**
 * Brings the plan up to date (see `syncPlan`) and returns the week and the `PHONE_DAY_COUNT` days from `shownDate`
 * (default: today), with their saved placements. `null` if no settings are saved yet.
 */
export async function loadCalendar(
  executor: Database | Transaction,
  now: Date,
  shownDate?: Temporal.PlainDate,
): Promise<Calendar | null> {
  const [settings, items] = await Promise.all([loadSettings(executor), loadItems(executor)]);
  if (!settings) return null;
  const { timeZone } = settings;
  const plan = await syncPlan(executor, items, settings, now);

  const today = localDate(now, timeZone);
  const week = weekOf(shownDate ?? today, timeZone);
  const days = daysFrom(shownDate ?? today, PHONE_DAY_COUNT, timeZone);
  const shown = { start: week.range.start, end: later(days.range.end, week.range.end) };
  const fixedItems = items.filter(isFixed).flatMap((item) => expandOccurrences(item, shown, timeZone));
  const targetFor = editTargets(items, now, timeZone);

  return {
    timeZone,
    weekDates: week.dates,
    dayDates: days.dates,
    today: today.toString(),
    navigation: {
      week: weekNavigation(week.dates[0], today.toString()),
      days: dayNavigation(days.dates[0], PHONE_DAY_COUNT),
    },
    blocks: toCalendarBlocks(fixedItems, await loadPlacements(executor, shown), timeZone, targetFor),
    queue: plan.unplaced
      .filter((task) => task.deadline > now)
      .map((task) => ({
        key: task.id,
        title: task.title,
        remainingMin: task.durationMin,
        deadline: task.deadline,
        target: targetFor(task.id)!,
      })),
  };
}

/** Finds the edit target for an item or occurrence id among `items`. */
function editTargets(items: Item[], now: Date, timeZone: TimeZone): (id: string) => EditTarget | undefined {
  const editable = new Map(
    items.map((item) => {
      const next = nextOccurrence(item, now, timeZone);
      return [item.id, next ? { ...next, id: item.id } : item];
    }),
  );
  return (id) => {
    const { itemId, date } = parseOccurrenceId(id);
    const item = editable.get(itemId);
    return item && { item, occurrenceDate: date };
  };
}
