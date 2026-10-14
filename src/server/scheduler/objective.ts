import { PRIORITIES, type Task } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import { minutesBetween } from "@/lib/time/duration";
import { intersectIntervals, type IntervalSet } from "@/lib/time/interval";

interface ScoredPlan {
  placements: Placement[];
  unplaced: Task[];
  /** The pending placements saved before the plan was made. */
  saved: Placement[];
  /** The time optional fixed items hold, with their buffers. */
  optionalTime: IntervalSet;
}

/** How far a plan misses one goal; 0 meets it. */
type Goal = (plan: ScoredPlan) => number;

function keepSaved({ placements, saved }: ScoredPlan): number {
  const kept = new Set(placements.map(placementKey));
  return saved.filter((placement) => !kept.has(placementKey(placement))).length;
}

/**
 * Every goal a plan is scored by, most important first: fewest tasks unplaced, level by level from the most important;
 * fewest minutes of blocks in optional fixed items' time; fewest saved blocks moved. Spread ranks below these but isn't
 * scored: it only shapes each task's own search.
 */
const GOALS: Goal[] = [
  ...PRIORITIES.map(
    (priority): Goal =>
      ({ unplaced }) =>
        unplaced.filter((task) => task.priority === priority).length,
  ),
  ({ placements, optionalTime }) =>
    intersectIntervals(placements, optionalTime).reduce((sum, time) => sum + minutesBetween(time.start, time.end), 0),
  keepSaved,
];

/** How far a plan misses each of `GOALS`, in their order. */
export type PlanScore = number[];

export const scorePlan = (plan: ScoredPlan): PlanScore => GOALS.map((goal) => goal(plan));

/** Whether a plan scored `score` misses a goal worth moving saved blocks for: one ranked above keeping them. */
export const worthMovingBlocks = (score: PlanScore): boolean =>
  score.slice(0, GOALS.indexOf(keepSaved)).some((missed) => missed > 0);

/**
 * Whether `a` beats `b`: each goal counts only where every goal before it ties, and priority comes first, so no number
 * of less important tasks outweighs one more important task.
 */
export function better(a: PlanScore, b: PlanScore): boolean {
  const goal = a.findIndex((value, i) => value !== b[i]);
  return goal !== -1 && a[goal] < b[goal];
}

export const placementKey = (placement: Placement) =>
  `${placement.taskId}@${placement.start.getTime()}-${placement.end.getTime()}`;
