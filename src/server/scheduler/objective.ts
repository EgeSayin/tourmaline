import { PRIORITIES } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import { minutesBetween } from "@/lib/time/duration";
import { intersectIntervals } from "@/lib/time/interval";
import { inPreferredHours, outsideOptionalItems, type Preference } from "./preferences";
import type { PlanTask } from "./task-time";

interface ScoredPlan {
  placements: Placement[];
  unplaced: PlanTask[];
  /** The pending placements saved before the plan was made. */
  saved: Placement[];
  tasks: ReadonlyMap<string, PlanTask>;
}

/** A goal for plans: how far a plan misses it, task by task (0 meets it), and the preference it is about, if any. */
interface Goal {
  miss: (plan: ScoredPlan) => [taskId: string, missed: number][];
  preference?: Preference;
}

const placeTasks: Goal = { miss: ({ unplaced }) => unplaced.map((task) => [task.id, 1]) };

const keepSaved: Goal = {
  miss: ({ placements, saved }) => {
    const kept = new Set(placements.map(placementKey));
    return saved.filter((placement) => !kept.has(placementKey(placement))).map((placement) => [placement.taskId, 1]);
  },
};

/** Minutes of each task's blocks outside the time `preference` keeps it to. */
const keepTo = (preference: Preference): Goal => ({
  preference,
  miss: ({ placements, tasks }) =>
    placements.flatMap((placement) => {
      const task = tasks.get(placement.taskId);
      if (!task) return [];
      const inside = intersectIntervals([placement], task.preferred[PREFERENCES.indexOf(preference)]);
      const insideMin = inside.reduce((sum, time) => sum + minutesBetween(time.start, time.end), 0);
      return [[placement.taskId, minutesBetween(placement.start, placement.end) - insideMin]];
    }),
});

/**
 * Every goal a plan is scored by, most important first, each settling who gets a time two tasks want: place every
 * task (the one that would otherwise wait in the queue gets it); keep out of optional fixed items' time; keep to
 * preferred hours; keep saved blocks where they are. Each goal is counted per priority level, most important
 * first, so within a goal a more important task always comes first. Spread ranks below these but isn't scored: it
 * only shapes each task's own search.
 */
const GOALS: Goal[] = [placeTasks, keepTo(outsideOptionalItems), keepTo(inPreferredHours), keepSaved];

/** The preferences of `GOALS`, in their order: a task gives up the last first. */
export const PREFERENCES = GOALS.flatMap((goal) => (goal.preference ? [goal.preference] : []));

/** How far a plan misses each of `GOALS` at each priority level, goal by goal. */
export type PlanScore = number[];

export function scorePlan(plan: ScoredPlan): PlanScore {
  return GOALS.flatMap((goal) => {
    const levels = PRIORITIES.map(() => 0);
    for (const [taskId, missed] of goal.miss(plan)) {
      const task = plan.tasks.get(taskId);
      if (task) levels[PRIORITIES.indexOf(task.priority)] += missed;
    }
    return levels;
  });
}

/** Whether a plan scored `score` misses a goal worth moving saved blocks for: one ranked above keeping them. */
export const worthMovingBlocks = (score: PlanScore): boolean =>
  score.slice(0, GOALS.indexOf(keepSaved) * PRIORITIES.length).some((missed) => missed > 0);

/** The tasks a plan shortchanges: those missing a goal worth moving saved blocks for. */
export function shortchanged(plan: ScoredPlan): Set<string> {
  const goals = GOALS.slice(0, GOALS.indexOf(keepSaved));
  return new Set(goals.flatMap((goal) => goal.miss(plan).flatMap(([taskId, missed]) => (missed > 0 ? [taskId] : []))));
}

/**
 * Whether `a` beats `b`: each goal counts only where every goal before it ties, and within a goal the more important
 * levels count first, so no number of less important tasks outweighs one more important task.
 */
export function better(a: PlanScore, b: PlanScore): boolean {
  const goal = a.findIndex((value, i) => value !== b[i]);
  return goal !== -1 && a[goal] < b[goal];
}

export const placementKey = (placement: Placement) =>
  `${placement.taskId}@${placement.start.getTime()}-${placement.end.getTime()}`;
