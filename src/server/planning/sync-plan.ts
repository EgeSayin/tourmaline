import { isFixed, type Item, isTask, itemSpan, type Task } from "@/lib/items";
import { isPending, type Placement } from "@/lib/placements";
import { RECURRENCE_LOOKAHEAD_DAYS, type SchedulerSettings } from "@/lib/settings";
import { addMinutes } from "@/lib/time/duration";
import { earlier, type Interval, later } from "@/lib/time/interval";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { loadPlacements, replacePendingPlacements } from "@/server/db/placements-repository";
import { expandOccurrences } from "@/server/recurrence";
import { replan } from "@/server/scheduler/replan";
import { localDate, startOfDay } from "@/server/time/temporal";

const MINUTES_PER_DAY = 24 * 60;

export interface Plan {
  /** The planned tasks: one-off tasks, and the occurrences of recurring ones. */
  tasks: Task[];
  /** Kept and newly placed, sorted by start. */
  placements: Placement[];
  /** Planned tasks whose remaining time didn't fit; `durationMin` is the remaining time. */
  unplaced: Task[];
}

/** Plans from `now` (see `replan`) and saves the plan if it changed. The plan runs to the latest one-off date; task occurrences within `RECURRENCE_LOOKAHEAD_DAYS` are planned up to their deadline. */
export async function syncPlan(tx: WorkspaceTx, items: Item[], settings: SchedulerSettings, now: Date): Promise<Plan> {
  const expand = <T extends Item>(list: T[], range: { start: Date; end: Date }) =>
    list.flatMap((item) => expandOccurrences(item, range, settings.timeZone));

  // A one-off task marked done doesn't extend the plan.
  const oneOffs = items.filter((item) => !item.recurrence && !(isTask(item) && item.done));
  const oneOffEnd = planningHorizon(now, oneOffs).end;
  const lookaheadEnd = addMinutes(now, RECURRENCE_LOOKAHEAD_DAYS * MINUTES_PER_DAY);
  const tasks = expand(items.filter(isTask), { start: now, end: earlier(oneOffEnd, lookaheadEnd) }).filter(
    (task) => !task.done,
  );
  const horizon = planningHorizon(now, [...oneOffs, ...tasks]);

  // Earlier placements matter as time already spent on a planned task, and today's toward today's focus cap.
  const todayStart = startOfDay(localDate(now, settings.timeZone), settings.timeZone);
  const historyStart = tasks.reduce((start, task) => earlier(start, task.earliestStart), todayStart);
  const existing = await loadPlacements(tx, { start: historyStart, end: horizon.end });
  const { placements, unplaced } = replan({
    horizon,
    fixedItems: expand(items.filter(isFixed), { start: todayStart, end: horizon.end }),
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

function samePlacements(a: Placement[], b: Placement[]): boolean {
  const key = (p: Placement) => `${p.taskId}|${p.start.getTime()}|${p.end.getTime()}|${p.pinned}|${p.status}`;
  return a.length === b.length && a.every((placement, i) => key(placement) === key(b[i]));
}

/** From `now` to the latest fixed item end or task deadline, or empty if none is after `now`. */
function planningHorizon(now: Date, items: Item[]): Interval {
  return { start: now, end: items.reduce((end, item) => later(end, itemSpan(item).end), now) };
}
