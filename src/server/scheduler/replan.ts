import { minutesBetween } from "@/lib/time/duration";
import { type FixedItem, PRIORITIES, type Task } from "@/lib/items";
import { isPending, type Placement } from "@/lib/placements";
import type { SchedulerSettings } from "@/lib/settings";
import { freeTimeMap } from "./free-time";
import { type Interval, type IntervalSet, later, overlaps, subtractIntervals } from "@/lib/time/interval";
import { BY_URGENCY, type PlanStrategy, placeTasks } from "./placement";
import { better, placementKey, scorePlan, worthMovingBlocks } from "./objective";
import { openTo, type PlanTask, planTask } from "./task-time";
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
 * placements are kept too while they remain valid (inside time their task may use, in free time, not overlapping),
 * and each task's remaining time is placed in the free time from `now` on, going in an optional fixed item's time only
 * when it is more important than the item and fits nowhere else (see `PlanTask.allowed`).
 *
 * Plans are compared by the goals of `better`. While the plan misses a goal worth moving blocks for (a task left out,
 * or one in an optional item's time), other plans are tried: for each priority
 * level, least important first, the pending placements of that level and below are dropped, first only those in the
 * way of an unplaced task, then all, and placed again in several orders (see `candidateStrategies`). A plan replaces
 * the best only if it beats it, so a tie keeps the one tried first. This repeats from the winner until it gains
 * nothing, so planning the result again changes nothing.
 */
export function replan({ horizon, fixedItems, tasks, existing, settings }: ReplanInput): ReplanResult {
  const now = horizon.start;
  const kept = existing.filter((placement) => placement.status !== "missed" && !isPending(placement, now));
  const movable = existing.filter((placement) => isPending(placement, now));

  const optional = fixedItems.filter((item) => item.priority !== "mandatory");
  const mandatory = fixedItems.filter((item) => item.priority === "mandatory");
  const free = subtractIntervals(now < horizon.end ? freeTimeMap(horizon, mandatory, settings) : [], kept);
  const context = { optional, timeZone: settings.timeZone };
  const planTasks = tasks.map((task) => planTask({ ...task, earliestStart: later(task.earliestStart, now) }, context));
  const planTasksById = new Map(planTasks.map((task) => [task.id, task]));

  const fill = (saved: Placement[], strategy: PlanStrategy) => {
    const plan = fillAroundKept(planTasks, kept, saved, free, strategy);
    return { ...plan, score: scorePlan({ ...plan, saved: movable, tasks: planTasksById }) };
  };

  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const priorityOf = (placement: Placement) => PRIORITIES.indexOf(tasksById.get(placement.taskId)!.priority);
  let best = fill(movable, BY_URGENCY);
  for (let improved = worthMovingBlocks(best.score); improved;) {
    const base = best;
    for (const keeping of keptVariants(base, now, priorityOf)) {
      for (const strategy of candidateStrategies(base)) {
        if (best.score.every((missed) => missed === 0)) break;
        const plan = fill(keeping, strategy);
        if (better(plan.score, best.score)) best = plan;
      }
    }
    improved = best !== base && worthMovingBlocks(best.score);
  }
  const unplaced = best.unplaced.map(({ allowed: _, preferred: __, searchOrder: ___, ...task }) => task);
  return { placements: best.placements, unplaced };
}

interface Plan {
  placements: Placement[];
  unplaced: PlanTask[];
}

/**
 * The pending placements of `plan` to keep in each variant: all of them, then for each priority level, least important
 * first, those of that level and below dropped where they overlap time an unplaced task may use, then all of them.
 * Each set comes once.
 */
function keptVariants(plan: Plan, now: Date, priorityOf: (placement: Placement) => number): Placement[][] {
  const pending = plan.placements.filter((placement) => isPending(placement, now));
  const inTheWay = (placement: Placement) =>
    plan.unplaced.some((task) => task.allowed.some((time) => overlaps(placement, time)));
  const variants = new Map([[pending.map(placementKey).join(), pending]]);
  for (let level = PRIORITIES.length - 1; level >= 0; level--) {
    const bumped = (placement: Placement) => priorityOf(placement) >= level;
    for (const keeping of [
      pending.filter((placement) => !bumped(placement) || !inTheWay(placement)),
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
function candidateStrategies(plan: Plan): PlanStrategy[] {
  return [
    BY_URGENCY,
    { order: byUrgency, reorder: true },
    { order: byEarliestDeadline, reorder: false },
    { order: withFirst(new Set(plan.unplaced.map((task) => task.id))), reorder: false },
  ];
}

/**
 * Keeps `kept`, keeps each of `saved` that still fits, then places every task's remaining time.
 */
function fillAroundKept(
  tasks: PlanTask[],
  kept: Placement[],
  saved: Placement[],
  free: IntervalSet,
  strategy: PlanStrategy,
): Plan {
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
  const { placements: added, unplaced } = placeTasks(remainingTasks, open, placed, strategy);

  const placements = [...kept, ...preserved, ...added].sort((a, b) => a.start.getTime() - b.start.getTime());
  const order = new Map(tasks.map((task, i) => [task.id, i]));
  return { placements, unplaced: unplaced.sort((a, b) => order.get(a.id)! - order.get(b.id)!) };
}
