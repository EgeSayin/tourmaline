import { bufferedSpan, type FixedItem, type NewTask, type Task } from "@/lib/items";
import { intersectIntervals, type IntervalSet, subtractIntervals } from "@/lib/time/interval";
import { everyDay } from "@/lib/time/time-of-day";
import type { TimeZone } from "@/lib/time/time-zone";
import { weeklyIntervals } from "@/server/time/weekly-ranges";

/** What a plan knows beyond each task: the optional fixed items, and the time zone hours of the day are in. */
export interface PlanContext {
  optional: FixedItem[];
  timeZone: TimeZone;
}

/** Where a task would rather its blocks went: the part of `allowed`, where it may go at all, that it keeps to. */
export type Preference = (task: Task, allowed: IntervalSet, context: PlanContext) => IntervalSet;

/** Outside optional fixed items, even those less important than the task, whose time it may take only to fit. */
export const outsideOptionalItems: Preference = (_, allowed, { optional }) =>
  subtractIntervals(allowed, optional.map(bufferedSpan));

/** Inside the task's time of day when it only prefers it. */
export const inPreferredHours: Preference = (task, allowed, { timeZone }) =>
  task.timeOfDay && !task.timeOfDay.must ? intersectIntervals(allowed, hoursOf(task, timeZone)) : allowed;

/** The times inside `task`'s window that its time of day covers. */
export function hoursOf(task: NewTask, timeZone: TimeZone): IntervalSet {
  return weeklyIntervals({ start: task.earliestStart, end: task.deadline }, everyDay(task.timeOfDay!), timeZone);
}
