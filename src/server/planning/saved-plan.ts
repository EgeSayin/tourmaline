import type { Item } from "@/lib/items";
import type { SchedulerSettings } from "@/lib/settings";
import { loadItems } from "@/server/db/items-repository";
import { loadPlan, type QueuedTask, savePlan } from "@/server/db/plans-repository";
import { loadSettings } from "@/server/db/settings-repository";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { localDate } from "@/server/time/temporal";
import { syncPlan } from "./sync-plan";

/** Plans the workspace from `now` (see `syncPlan`) and saves the plan; for after any change to what it plans from. */
export async function replanWorkspace(
  tx: WorkspaceTx,
  now: Date,
  items?: Item[],
  settings?: SchedulerSettings,
): Promise<QueuedTask[]> {
  const { unplaced } = await syncPlan(tx, items ?? (await loadItems(tx)), settings ?? (await loadSettings(tx)), now);
  const queue = unplaced.map(({ id, title, durationMin, deadline }) => ({
    id,
    title,
    remainingMin: durationMin,
    deadline,
  }));
  await savePlan(tx, { plannedAt: now, queue });
  return queue;
}

/**
 * The saved plan's queue, planning again first when the plan isn't from `now`'s local day: each day brings recurring
 * tasks' next occurrences within reach (see `RECURRENCE_LOOKAHEAD_DAYS`), and nothing else changes a plan as time
 * passes.
 */
export async function currentQueue(
  tx: WorkspaceTx,
  items: Item[],
  settings: SchedulerSettings,
  now: Date,
): Promise<QueuedTask[]> {
  const saved = await loadPlan(tx);
  const sameDay = (date: Date) => localDate(date, settings.timeZone).equals(localDate(now, settings.timeZone));
  return saved && sameDay(saved.plannedAt) ? saved.queue : replanWorkspace(tx, now, items, settings);
}
