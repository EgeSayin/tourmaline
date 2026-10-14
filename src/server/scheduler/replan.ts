import { minutesBetween } from "@/lib/time/duration";
import { type FixedItem, PRIORITIES, type Task } from "@/lib/items";
import { isPending, type Placement } from "@/lib/placements";
import { FOCUS_CAP_RAISES_MIN, type SchedulerSettings } from "@/lib/settings";
import { freeTimeMap } from "./free-time";
import {
  type Interval,
  type IntervalSet,
  later,
  mergeIntervals,
  overlaps,
  subtractIntervals,
} from "@/lib/time/interval";
import { type FocusDay, focusDays } from "./focus-cap";
import { BY_URGENCY, type PlanStrategy, placeTasks } from "./placement";
import { better, placementKey, scorePlan } from "./objective";
import { openTo, taskWindow } from "./task-time";
import { byEarliestDeadline, byUrgency, withFirst } from "./urgency";

export interface ReplanInput {
  /** Starts now: earlier placements are done, and new ones go inside it. */
  horizon: Interval;
  fixedItems: FixedItem[];
  tasks: Task[];
  /** Placements saved from earlier runs. */
  existing: Placement[];
  settings: SchedulerSettings;
}

export interface ReplanResult {
  /** Kept and newly placed, sorted by start; missed ones are left out. */
  placements: Placement[];
  /** Tasks whose remaining time didn't fit, in the order given; `durationMin` is the remaining time. */
  unplaced: Task[];
}

/**
 * Keeps placements that are done, pinned or in progress, and past planned ones still waiting to be reviewed, so
 * their task's time isn't moved before they are; missed ones are dropped, so their time is planned again. Pending
 * placements are kept too while they remain valid (inside their task's window, in free time, not overlapping), and
 * each task's remaining time is placed in the free time from `now` on, under each local day's focus cap; `fixedItems`
 * and `existing` should cover all of today for today's to count.
 *
 * Plans are compared by the goals of `better`: fewest tasks unplaced, level by level from the most important, then
 * the fewest minutes over focus caps, then the fewest saved blocks moved. If some task doesn't fit, the goals are given
 * up from the least important: other plans are tried that move pending placements, for each priority level, least
 * important first, those of that level and below, first only those in the way of an unplaced task, then all, each
 * placed again in several orders (see `candidateStrategies`); only then do plans go over the caps, by as little as
 * they can. A plan replaces the best only if it beats it, so a tie keeps the one tried first. This repeats from the
 * winner until it gains nothing, so planning the result again changes nothing.
 *
 * A task still left out then goes in time optional fixed items of lower priority hold, where it fits that way (see
 * `placeOverOptional`); nothing about it is stored, so each plan decides it again.
 */
export function replan({ horizon, fixedItems, tasks, existing, settings }: ReplanInput): ReplanResult {
  const now = horizon.start;
  const kept = existing.filter((placement) => placement.status !== "missed" && !isPending(placement, now));
  const movable = existing.filter((placement) => isPending(placement, now));

  const freeTimeOf = (holding: FixedItem[]) =>
    now < horizon.end ? freeTimeMap(horizon, holding, settings) : mergeIntervals([]);
  const free = subtractIntervals(freeTimeOf(fixedItems), kept);
  const startingNow = tasks.map((task) => ({
    ...task,
    earliestStart: later(task.earliestStart, now),
  }));

  const fixedTimes = fixedItems.map(({ start, end }) => ({ start, end }));
  const daysAround = (placements: Placement[]) =>
    focusDays(horizon, [...fixedTimes, ...placements], settings.focusCaps, settings.timeZone);
  const fillAround = (saved: Placement[], strategy: PlanStrategy, capRaisesMin: readonly number[]) => {
    const plan = fillAroundKept(startingNow, kept, saved, free, daysAround, strategy, capRaisesMin);
    return { ...plan, score: scorePlan(plan, daysAround(plan.placements), movable) };
  };

  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const priorityOf = (placement: Placement) => PRIORITIES.indexOf(tasksById.get(placement.taskId)!.priority);
  let best = fillAround(movable, BY_URGENCY, UNDER_CAPS);
  for (let improved = best.unplaced.length > 0; improved;) {
    const base = best;
    for (const capRaisesMin of [UNDER_CAPS, FOCUS_CAP_RAISES_MIN]) {
      for (const keeping of keptVariants(base, now, priorityOf)) {
        for (const strategy of candidateStrategies(base)) {
          if (best.unplaced.length === 0) break;
          const plan = fillAround(keeping, strategy, capRaisesMin);
          if (better(plan.score, best.score)) best = plan;
        }
      }
    }
    improved = best !== base && best.unplaced.length > 0;
  }
  const plan = { placements: best.placements, unplaced: best.unplaced };
  return plan.unplaced.length > 0 ? placeOverOptional(plan, fixedItems, freeTimeOf, daysAround) : plan;
}

/** No raise: every day stays under its focus cap. */
const UNDER_CAPS = [0];

/**
 * `plan` with each task it leaves out, most important first, placed in time optional fixed items of lower priority
 * hold too, where it fits that way: such an item gives way only to a more important task that fits nowhere else.
 */
function placeOverOptional(
  plan: ReplanResult,
  fixedItems: FixedItem[],
  freeTimeOf: (holding: FixedItem[]) => IntervalSet,
  daysAround: (placements: Placement[]) => FocusDay[],
): ReplanResult {
  let { placements } = plan;
  const unplaced: Task[] = [];
  for (const task of byEarliestDeadline(plan.unplaced, mergeIntervals([]))) {
    const level = PRIORITIES.indexOf(task.priority);
    const holding = fixedItems.filter(
      (item) => item.priority === "mandatory" || PRIORITIES.indexOf(item.priority) <= level,
    );
    const open = subtractIntervals(freeTimeOf(holding), placements);
    const added =
      holding.length < fixedItems.length ? placeTasks([task], open, placements, daysAround(placements)) : null;
    if (added && added.unplaced.length === 0) {
      placements = [...placements, ...added.placements].sort((a, b) => a.start.getTime() - b.start.getTime());
    } else {
      unplaced.push(task);
    }
  }
  const order = new Map(plan.unplaced.map((task, i) => [task.id, i]));
  return { placements, unplaced: unplaced.sort((a, b) => order.get(a.id)! - order.get(b.id)!) };
}

/**
 * The pending placements of `plan` to keep in each variant: all of them, then for each priority level, least important
 * first, those of that level and below dropped where they overlap an unplaced task's window, then all of them. Each
 * set comes once.
 */
function keptVariants(plan: ReplanResult, now: Date, priorityOf: (placement: Placement) => number): Placement[][] {
  const pending = plan.placements.filter((placement) => isPending(placement, now));
  const windows = plan.unplaced.map(taskWindow);
  const variants = new Map([[pending.map(placementKey).join(), pending]]);
  for (let level = PRIORITIES.length - 1; level >= 0; level--) {
    const bumped = (placement: Placement) => priorityOf(placement) >= level;
    for (const keeping of [
      pending.filter((placement) => !bumped(placement) || !windows.some((window) => overlaps(placement, window))),
      pending.filter((placement) => !bumped(placement)),
    ]) {
      variants.set(keeping.map(placementKey).join(), keeping);
    }
  }
  return [...variants.values()];
}

/**
 * The orders tried on each variant: by urgency, by urgency ranked again after each placement, by earliest deadline,
 * and with `plan`'s unplaced tasks first.
 */
function candidateStrategies(plan: ReplanResult): PlanStrategy[] {
  return [
    BY_URGENCY,
    { order: byUrgency, reorder: true },
    { order: byEarliestDeadline, reorder: false },
    { order: withFirst(new Set(plan.unplaced.map((task) => task.id))), reorder: false },
  ];
}

/**
 * Keeps `kept`, keeps each of `saved` that still fits, then places every task's remaining time under the focus caps
 * of `daysAround` what's kept, going over them at most by the last of `capRaisesMin`.
 */
function fillAroundKept(
  tasks: Task[],
  kept: Placement[],
  saved: Placement[],
  free: IntervalSet,
  daysAround: (placements: Placement[]) => FocusDay[],
  strategy: PlanStrategy,
  capRaisesMin: readonly number[],
): ReplanResult {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const placedMinutes = new Map<string, number>();
  const countPlaced = (placement: Placement) =>
    placedMinutes.set(
      placement.taskId,
      (placedMinutes.get(placement.taskId) ?? 0) + minutesBetween(placement.start, placement.end),
    );
  kept.forEach(countPlaced);

  let open = free;
  const preserved: Placement[] = [];
  for (const placement of [...saved].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    const task = tasksById.get(placement.taskId);
    if (!task) continue;
    const remaining = task.durationMin - (placedMinutes.get(task.id) ?? 0);
    const fits =
      minutesBetween(placement.start, placement.end) <= remaining &&
      subtractIntervals([placement], openTo(task, open)).length === 0;
    if (!fits) continue;

    preserved.push(placement);
    countPlaced(placement);
    open = subtractIntervals(open, [placement]);
  }

  const remainingTasks = tasks
    .map((task) => ({ ...task, durationMin: task.durationMin - (placedMinutes.get(task.id) ?? 0) }))
    .filter((task) => task.durationMin > 0);
  const placed = [...kept, ...preserved];
  const { placements: added, unplaced } = placeTasks(
    remainingTasks,
    open,
    placed,
    daysAround(placed),
    strategy,
    capRaisesMin,
  );

  const placements = [...kept, ...preserved, ...added].sort((a, b) => a.start.getTime() - b.start.getTime());
  const order = new Map(tasks.map((task, i) => [task.id, i]));
  return { placements, unplaced: unplaced.sort((a, b) => order.get(a.id)! - order.get(b.id)!) };
}
