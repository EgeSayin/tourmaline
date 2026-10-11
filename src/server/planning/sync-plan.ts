import "server-only";
import { isFixed, type Item, isTask, type Task } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import { RECURRENCE_LOOKAHEAD_DAYS, type SchedulerSettings } from "@/lib/settings";
import { addMinutes } from "@/lib/time/duration";
import { earlier } from "@/lib/time/interval";
import type { Database, Transaction } from "@/server/db/connection";
import { loadPlacements, replacePendingPlacements } from "@/server/db/placements-repository";
import { expandOccurrences } from "@/server/recurrence";
import { replan } from "@/server/scheduler/replan";
import { planningHorizon } from "./horizon";

const MINUTES_PER_DAY = 24 * 60;

export interface Plan {
  /** The planned tasks: one-off tasks, and the occurrences of recurring ones. */
  tasks: Task[];
  /** Kept and newly placed, sorted by start. */
  placements: Placement[];
  /** Planned tasks whose remaining time didn't fit; `durationMin` is the remaining time. */
  unplaced: Task[];
}

/**
 * Re-plans from `now` around the saved placements and saves the plan if it changed. The plan runs to the latest
 * one-off item date; recurring items don't extend it, but a task occurrence overlapping it, within
 * `RECURRENCE_LOOKAHEAD_DAYS`, is planned up to its deadline. Placements before `now` count toward each task's time.
 * Re-planning an unchanged plan changes nothing, so repeated calls don't write.
 */
export async function syncPlan(
  executor: Database | Transaction,
  items: Item[],
  settings: SchedulerSettings,
  now: Date,
): Promise<Plan> {
  const expand = <T extends Item>(list: T[], range: { start: Date; end: Date }) =>
    list.flatMap((item) => expandOccurrences(item, range, settings.timeZone));

  const oneOffs = items.filter((item) => !item.recurrence);
  const oneOffEnd = planningHorizon(now, oneOffs).end;
  const lookaheadEnd = addMinutes(now, RECURRENCE_LOOKAHEAD_DAYS * MINUTES_PER_DAY);
  const tasks = expand(items.filter(isTask), { start: now, end: earlier(oneOffEnd, lookaheadEnd) });
  const horizon = planningHorizon(now, [...oneOffs, ...tasks]);

  // Earlier placements matter only as time already spent on a planned task.
  const historyStart = tasks.reduce((start, task) => earlier(start, task.earliestStart), now);
  const existing = await loadPlacements(executor, { start: historyStart, end: horizon.end });
  const { placements, unplaced } = replan({
    horizon,
    fixedItems: expand(items.filter(isFixed), horizon),
    tasks,
    existing,
    settings,
  });

  const pending = (list: Placement[]) => list.filter((p) => !p.pinned && p.start >= now);
  if (!samePlacements(pending(existing), pending(placements))) {
    await executor.transaction((tx) => replacePendingPlacements(tx, now, placements));
  }
  return { tasks, placements, unplaced };
}

/** Whether both lists, each sorted by start, hold the same placements. */
function samePlacements(a: Placement[], b: Placement[]): boolean {
  const key = (p: Placement) => `${p.taskId}|${p.start.getTime()}|${p.end.getTime()}|${p.source}|${p.pinned}`;
  return a.length === b.length && a.every((placement, i) => key(placement) === key(b[i]));
}
