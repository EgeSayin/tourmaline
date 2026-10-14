import { PRIORITIES, type Task } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import { type FocusDay, overCapMinutes } from "./focus-cap";

/** How well a plan meets each goal, most important first; lower is better. */
export interface PlanScore {
  /** Tasks left unplaced per priority level, most important first. */
  unplaced: number[];
  overCapMin: number;
  /** Saved pending blocks the plan doesn't keep where they were. */
  movedBlocks: number;
}

/**
 * Scores a plan whose `days` count its placements. Optional fixed items and spread rank between and below these
 * goals but aren't scored: optional time is used only by tasks no plan places otherwise, and spread only shapes each
 * task's own search.
 */
export function scorePlan(
  { placements, unplaced }: { placements: Placement[]; unplaced: Task[] },
  days: FocusDay[],
  saved: Placement[],
): PlanScore {
  const kept = new Set(placements.map(placementKey));
  return {
    unplaced: PRIORITIES.map((priority) => unplaced.filter((task) => task.priority === priority).length),
    overCapMin: overCapMinutes(days),
    movedBlocks: saved.filter((placement) => !kept.has(placementKey(placement))).length,
  };
}

/**
 * Whether `a` beats `b`: each goal counts only where every goal before it ties, and priority comes first, so no number
 * of less important tasks outweighs one more important task.
 */
export function better(a: PlanScore, b: PlanScore): boolean {
  const goals = (score: PlanScore) => [...score.unplaced, score.overCapMin, score.movedBlocks];
  const [goalsA, goalsB] = [goals(a), goals(b)];
  const goal = goalsA.findIndex((value, i) => value !== goalsB[i]);
  return goal !== -1 && goalsA[goal] < goalsB[goal];
}

export const placementKey = (placement: Placement) =>
  `${placement.taskId}@${placement.start.getTime()}-${placement.end.getTime()}`;
