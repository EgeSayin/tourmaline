import { bufferedSpan, PRIORITIES, type Task } from "@/lib/items";
import { type Interval, type IntervalSet, intersectIntervals, subtractIntervals } from "@/lib/time/interval";
import { PREFERENCES } from "./objective";
import { hoursOf, type PlanContext } from "./preferences";

/** A task as one plan sees it: with the times its blocks may use, worked out once per plan. */
export interface PlanTask extends Task {
  /** Where its blocks may go at all: its window, less what its hard rules keep it out of. */
  allowed: IntervalSet;
  /** The part of `allowed` each of `PREFERENCES` keeps it to, in their order. */
  preferred: IntervalSet[];
  /** Where to search, in turn, until it fits: `allowed` cut to its preferences, giving up the least important first. */
  searchOrder: IntervalSet[];
}

const NO_CONTEXT: PlanContext = { optional: [], timeZone: "UTC" };

/**
 * `task` with the times its blocks may use: never in an optional fixed item at least as important as it, and only in
 * its time of day when it must be.
 */
export function planTask(task: Task, context: PlanContext = NO_CONTEXT): PlanTask {
  const level = (item: Pick<Task, "priority">) => PRIORITIES.indexOf(item.priority);
  const holding = context.optional.filter((item) => level(item) <= level(task));
  const outsideHolding = subtractIntervals([taskWindow(task)], holding.map(bufferedSpan));
  const allowed = task.timeOfDay?.must
    ? intersectIntervals(outsideHolding, hoursOf(task, context.timeZone))
    : outsideHolding;
  const preferred = PREFERENCES.map((preference) => preference(task, allowed, context));
  return { ...task, allowed, preferred, searchOrder: searchOrder(allowed, preferred) };
}

/**
 * `allowed` cut to every combination of `preferred`, ordered so the more important a preference, the later it is given
 * up: all of them, then all but the last, …, down to none. Combinations that leave the same time come once.
 */
function searchOrder(allowed: IntervalSet, preferred: IntervalSet[]): IntervalSet[] {
  const order = new Map<string, IntervalSet>();
  for (let kept = 2 ** preferred.length - 1; kept >= 0; kept--) {
    const time = preferred.reduce(
      (cut, preference, i) => ((kept >> (preferred.length - 1 - i)) & 1 ? intersectIntervals(cut, preference) : cut),
      allowed,
    );
    order.set(time.map(({ start, end }) => `${start.getTime()}-${end.getTime()}`).join(), time);
  }
  return [...order.values()];
}

/** The span `task`'s blocks must fall in: from its earliest start to its deadline. */
export function taskWindow(task: Task): Interval {
  return { start: task.earliestStart, end: task.deadline };
}

/** The parts of `free` that `task`'s blocks may use at all. Every placement decision about a task goes through this. */
export function openTo(task: PlanTask, free: IntervalSet): IntervalSet {
  return intersectIntervals(free, task.allowed);
}
