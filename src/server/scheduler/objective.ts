import { PRIORITIES, type Task } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import { type FocusDay, overCapMinutes } from "./focus-cap";

interface ScoredPlan {
  placements: Placement[];
  unplaced: Task[];
  /** The local days the plan covers, counting its placements. */
  days: FocusDay[];
  /** The pending placements saved before the plan was made. */
  saved: Placement[];
}

/** How far a plan misses one goal; 0 meets it. */
type Goal = (plan: ScoredPlan) => number;

/**
 * Every goal a plan is scored by, most important first: fewest tasks unplaced, level by level from the most important;
 * fewest minutes over focus caps; fewest saved blocks moved. Optional fixed items and spread rank between and below
 * these but aren't scored: optional time is used only by tasks no plan places otherwise, and spread only shapes each
 * task's own search.
 */
const GOALS: Goal[] = [
  ...PRIORITIES.map(
    (priority): Goal =>
      ({ unplaced }) =>
        unplaced.filter((task) => task.priority === priority).length,
  ),
  ({ days }) => overCapMinutes(days),
  ({ placements, saved }) => {
    const kept = new Set(placements.map(placementKey));
    return saved.filter((placement) => !kept.has(placementKey(placement))).length;
  },
];

/** How far a plan misses each of `GOALS`, in their order. */
export type PlanScore = number[];

export const scorePlan = (plan: ScoredPlan): PlanScore => GOALS.map((goal) => goal(plan));

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
