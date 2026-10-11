import { type CalendarBlock, type EditTarget, toCalendarBlocks } from "@/lib/calendar-blocks";
import { isFixed, type Item } from "@/lib/items";
import type { PlacementRef } from "@/lib/placements";
import { parseOccurrenceId } from "@/lib/recurrence";
import type { FocusCaps } from "@/lib/settings";
import { later } from "@/lib/time/interval";
import type { TimeZone } from "@/lib/time/time-zone";
import { type CategoryEntry, listCategories } from "@/server/categories/category-list";
import { loadCategories } from "@/server/db/categories-repository";
import type { Executor } from "@/server/db/connection";
import { loadItems } from "@/server/db/items-repository";
import { loadPlacements, loadPlacementsToReview } from "@/server/db/placements-repository";
import { loadSettings } from "@/server/db/settings-repository";
import { syncPlan } from "@/server/planning/sync-plan";
import { focusDays } from "@/server/scheduler/focus-cap";
import { expandOccurrences, nextOccurrence } from "@/server/recurrence";
import { listTasks, type TaskEntry } from "@/server/tasks";
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

/** A past block waiting to be checked off or marked missed. */
export interface ReviewEntry {
  /** Unique among the entries. */
  key: string;
  title: string;
  start: Date;
  end: Date;
  ref: PlacementRef;
  target: EditTarget;
}

/** How much of a day its fixed items and blocks fill, missed ones aside, against its focus cap. */
export interface DayLoad {
  usedMin: number;
  capMin: number | null;
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
  /** Each date of the week and the days, by local date. */
  loads: Record<string, DayLoad>;
  focusCaps: FocusCaps;
  /** Planned tasks due after now whose remaining time doesn't fit before their deadline. */
  queue: QueueEntry[];
  /** Every past block still to review, oldest first. */
  review: ReviewEntry[];
  /** Every item, for the task list. */
  tasks: TaskEntry[];
  /** Every category, by name, with its item count. */
  categories: CategoryEntry[];
}

/**
 * Brings the plan up to date (see `syncPlan`) and returns the week and the `PHONE_DAY_COUNT` days from `shownDate`
 * (default: today), with their saved placements, the lists and every item. `null` if no settings are saved yet.
 */
export async function loadCalendar(
  executor: Executor,
  now: Date,
  shownDate?: Temporal.PlainDate,
): Promise<Calendar | null> {
  const [settings, items, categories] = await Promise.all([
    loadSettings(executor),
    loadItems(executor),
    loadCategories(executor),
  ]);
  if (!settings) return null;
  const { timeZone } = settings;
  const plan = await syncPlan(executor, items, settings, now);

  const today = localDate(now, timeZone);
  const week = weekOf(shownDate ?? today, timeZone);
  const days = daysFrom(shownDate ?? today, PHONE_DAY_COUNT, timeZone);
  const shown = { start: week.range.start, end: later(days.range.end, week.range.end) };
  const fixedItems = items.filter(isFixed).flatMap((item) => expandOccurrences(item, shown, timeZone));
  const targetFor = editTargets(items, now, timeZone);
  const placements = await loadPlacements(executor, shown);
  const busy = [...fixedItems, ...placements.filter((placement) => placement.status !== "missed")];

  return {
    timeZone,
    weekDates: week.dates,
    dayDates: days.dates,
    today: today.toString(),
    navigation: {
      week: weekNavigation(week.dates[0], today.toString()),
      days: dayNavigation(days.dates[0], PHONE_DAY_COUNT),
    },
    blocks: toCalendarBlocks(fixedItems, placements, timeZone, targetFor, categories, now),
    loads: Object.fromEntries(
      focusDays(shown, busy, settings.focusCaps, timeZone).map(({ date, usedMin, capMin }) => [
        date,
        { usedMin, capMin },
      ]),
    ),
    focusCaps: settings.focusCaps,
    queue: plan.unplaced
      .filter((task) => task.deadline > now)
      .map((task) => ({
        key: task.id,
        title: task.title,
        remainingMin: task.durationMin,
        deadline: task.deadline,
        target: targetFor(task.id)!,
      })),
    review: (await loadPlacementsToReview(executor, now)).flatMap(({ taskId, start, end }) => {
      const target = targetFor(taskId);
      return target
        ? [
            {
              key: `${taskId}@${start.toISOString()}`,
              title: target.item.title,
              start,
              end,
              ref: { taskId, start },
              target,
            },
          ]
        : [];
    }),
    tasks: listTasks(items, plan.unplaced, targetFor, now),
    categories: listCategories(categories, items),
  };
}

/** Finds the edit target for an item or occurrence id among `items`. */
export function editTargets(items: Item[], now: Date, timeZone: TimeZone): (id: string) => EditTarget | undefined {
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
