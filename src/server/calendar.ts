import "server-only";
import { type CalendarBlock, type EditTarget, toCalendarBlocks } from "@/lib/calendar-blocks";
import { type FixedItem, isFixed, type Item } from "@/lib/items";
import type { PlacementRef } from "@/lib/placements";
import { later } from "@/lib/time/interval";
import type { TimeZone } from "@/lib/time/time-zone";
import { type CategoryEntry, listCategories } from "@/server/categories/category-list";
import { loadCategories } from "@/server/db/categories-repository";
import type { Database, Transaction } from "@/server/db/connection";
import { loadItems } from "@/server/db/items-repository";
import { loadPlacements, loadPlacementsToReview } from "@/server/db/placements-repository";
import { loadSettings } from "@/server/db/settings-repository";
import { syncPlan } from "@/server/planning/sync-plan";
import { expandOccurrences, occurrenceOn } from "@/server/recurrence";
import { editTargets } from "@/server/edit-targets";
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

/** A task that doesn't fit before its deadline, or a fixed item that was bumped. */
export type QueueEntry = {
  /** Unique among the entries. */
  key: string;
  title: string;
  target: EditTarget;
} & ({ kind: "task"; remainingMin: number; deadline: Date } | { kind: "bumped"; start: Date; end: Date });

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
  /**
   * Planned tasks due after now whose remaining time doesn't fit before their deadline, then the bumped fixed items
   * and occurrences that haven't ended, by start.
   */
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
  executor: Database | Transaction,
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
  const fixedItems = items
    .filter(isFixed)
    .flatMap((item) => expandOccurrences(item, shown, timeZone))
    .filter((item) => !item.bumped);
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
    blocks: toCalendarBlocks(fixedItems, await loadPlacements(executor, shown), timeZone, targetFor, categories, now),
    queue: [
      ...plan.unplaced
        .filter((task) => task.deadline > now)
        .map((task) => ({
          kind: "task" as const,
          key: task.id,
          title: task.title,
          remainingMin: task.durationMin,
          deadline: task.deadline,
          target: targetFor(task.id)!,
        })),
      ...bumpedOccurrences(items, now, timeZone).map(({ id, title, start, end }) => ({
        kind: "bumped" as const,
        key: id,
        title,
        start,
        end,
        target: targetFor(id)!,
      })),
    ],
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

/** The bumped one-off fixed items and occurrences that end after `now`, by start. */
function bumpedOccurrences(items: Item[], now: Date, timeZone: TimeZone): FixedItem[] {
  return items
    .filter(isFixed)
    .flatMap((item) =>
      item.recurrence
        ? item.overrides
            .filter((override) => override.bumped)
            .flatMap((override) => occurrenceOn(item, override.date, timeZone) ?? [])
        : [item],
    )
    .filter((item) => item.bumped && item.end > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
