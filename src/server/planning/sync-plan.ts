import { isFixed, type Item, isTask, itemSpan, type Task } from "@/lib/items";
import { isPending, type Placement } from "@/lib/placements";
import { RECURRENCE_LOOKAHEAD_DAYS, type SchedulerSettings } from "@/lib/settings";
import { addMinutes, minutesBetween } from "@/lib/time/duration";
import { earlier, type Interval, later } from "@/lib/time/interval";
import { MINUTES_PER_DAY } from "@/lib/time/time-of-day";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { loadItemPlacements, loadPlacementsFrom, replacePendingPlacements } from "@/server/db/placements-repository";
import { expandOccurrences } from "@/server/recurrence";
import { replan } from "@/server/scheduler/replan";

export interface Plan {
  /** The planned tasks: one-off tasks, and the occurrences of recurring ones. */
  tasks: Task[];
  /** Kept and newly placed, sorted by start. */
  placements: Placement[];
  /** Planned tasks whose remaining time didn't fit; `durationMin` is the remaining time. */
  unplaced: Task[];
}

/** Plans from `now` (see `replan`) and saves the plan if it changed. */
export async function syncPlan(tx: WorkspaceTx, items: Item[], settings: SchedulerSettings, now: Date): Promise<Plan> {
  const { tasks, horizon, existing } = await loadScope(tx, items, settings, now);
  const { placements, unplaced } = replan({
    horizon,
    fixedItems: items.filter(isFixed).flatMap((item) => expandOccurrences(item, horizon, settings.timeZone)),
    tasks,
    existing,
    settings,
  });

  const pending = (list: Placement[]) => list.filter((p) => isPending(p, now));
  if (!samePlacements(pending(existing), pending(placements))) {
    await replacePendingPlacements(tx, now, placements);
  }
  return { tasks, placements, unplaced };
}

/**
 * The tasks the plan `syncPlan` saved at `plannedAt` holds whose remaining time it doesn't, as it reported them:
 * `durationMin` is the remaining time. Exact while nothing it plans from has changed since.
 */
export async function loadUnplaced(
  tx: WorkspaceTx,
  items: Item[],
  settings: SchedulerSettings,
  plannedAt: Date,
): Promise<Task[]> {
  const { tasks, existing } = await loadScope(tx, items, settings, plannedAt);
  const spentMin = new Map<string, number>();
  for (const placement of existing) {
    if (placement.status === "missed") continue;
    const minutes = minutesBetween(placement.start, placement.end);
    spentMin.set(placement.taskId, (spentMin.get(placement.taskId) ?? 0) + minutes);
  }
  return tasks.flatMap((task) => {
    if (task.upTo) return [];
    const remainingMin = task.durationMin - (spentMin.get(task.id) ?? 0);
    return remainingMin > 0 ? [{ ...task, durationMin: remainingMin }] : [];
  });
}

/**
 * What a plan from `now` covers: the planned tasks (one-off tasks, and the occurrences of recurring ones), its
 * horizon, which runs to the latest one-off date, with task occurrences within `RECURRENCE_LOOKAHEAD_DAYS` planned up
 * to their deadline, and the placements saved so far that matter to it.
 */
async function loadScope(tx: WorkspaceTx, items: Item[], settings: SchedulerSettings, now: Date) {
  // A one-off task marked done doesn't extend the plan.
  const oneOffs = items.filter((item) => !item.recurrence && !(isTask(item) && item.done));
  const oneOffEnd = planningHorizon(now, oneOffs).end;
  const lookaheadEnd = addMinutes(now, RECURRENCE_LOOKAHEAD_DAYS * MINUTES_PER_DAY);
  const range = { start: now, end: earlier(oneOffEnd, lookaheadEnd) };
  const expanded = await Promise.all(
    items.filter(isTask).map(async (item) => {
      const occurrences = expandOccurrences(item, range, settings.timeZone).filter((task) => !task.done);
      if (item.totalMin === null) return occurrences;
      return withinTotal(item.totalMin, occurrences, await loadItemPlacements(tx, item.id), now);
    }),
  );
  const tasks = expanded.flat();
  const horizon = planningHorizon(now, [...oneOffs, ...tasks]);

  // Earlier placements matter as time already spent on a planned task. Not bounded by the horizon, so pending blocks
  // past it, left from a longer plan, are compared and replaced too.
  const historyStart = tasks.reduce((start, task) => earlier(start, task.earliestStart), now);
  const existing = await loadPlacementsFrom(tx, historyStart);
  return { tasks, horizon, existing };
}

/**
 * A series' planned `occurrences`, in order, each cut to what's left of `totalMin` after the time its other blocks in
 * `placements` took, missed and pending ones aside; those left with none are dropped. Each occurrence's own blocks
 * count against its own duration as it's planned.
 */
function withinTotal(totalMin: number, occurrences: Task[], placements: Placement[], now: Date): Task[] {
  const planned = new Set(occurrences.map((task) => task.id));
  let leftMin = placements
    .filter((p) => p.status !== "missed" && !isPending(p, now) && !planned.has(p.taskId))
    .reduce((left, p) => left - minutesBetween(p.start, p.end), totalMin);
  return occurrences.flatMap((task) => {
    const durationMin = Math.min(task.durationMin, leftMin);
    leftMin -= durationMin;
    return durationMin > 0 ? [{ ...task, durationMin }] : [];
  });
}

function samePlacements(a: Placement[], b: Placement[]): boolean {
  const key = (p: Placement) => `${p.taskId}|${p.start.getTime()}|${p.end.getTime()}|${p.pinned}|${p.status}`;
  return a.length === b.length && a.every((placement, i) => key(placement) === key(b[i]));
}

/** From `now` to the latest fixed item end or task deadline, or empty if none is after `now`. */
function planningHorizon(now: Date, items: Item[]): Interval {
  return { start: now, end: items.reduce((end, item) => later(end, itemSpan(item).end), now) };
}
