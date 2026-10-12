import type { Item } from "@/lib/items";
import type { SchedulerSettings } from "@/lib/settings";
import { loadItems } from "@/server/db/items-repository";
import { loadSettings } from "@/server/db/settings-repository";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { loadPlannedAt, savePlannedAt } from "@/server/db/workspaces-repository";
import { localDate } from "@/server/time/temporal";
import { loadUnplaced, syncPlan } from "./sync-plan";

/** A planned task whose remaining time didn't fit before its deadline. */
export interface QueuedTask {
  /** The task's id, or its occurrence's. */
  id: string;
  title: string;
  remainingMin: number;
  deadline: Date;
}

/** Plans the workspace from `now` (see `syncPlan`) and marks it planned then; for after any change to what it plans from. */
export async function replanWorkspace(tx: WorkspaceTx, now: Date): Promise<void> {
  await syncPlan(tx, await loadItems(tx), await loadSettings(tx), now);
  await savePlannedAt(tx, now);
}

/**
 * Whether the workspace was planned on `now`'s local day. Each day brings recurring tasks' next occurrences within
 * reach (see `RECURRENCE_LOOKAHEAD_DAYS`), and nothing else changes a plan as time passes.
 */
export async function plannedToday(tx: WorkspaceTx, now: Date): Promise<boolean> {
  const [plannedAt, { timeZone }] = await Promise.all([loadPlannedAt(tx), loadSettings(tx)]);
  return plannedAt !== null && localDate(plannedAt, timeZone).equals(localDate(now, timeZone));
}

/** The saved plan's queue (see `loadUnplaced`); the workspace must have been planned. */
export async function loadQueue(tx: WorkspaceTx, items: Item[], settings: SchedulerSettings): Promise<QueuedTask[]> {
  const plannedAt = await loadPlannedAt(tx);
  if (!plannedAt) throw new Error("The workspace hasn't been planned");
  return (await loadUnplaced(tx, items, settings, plannedAt)).map(({ id, title, durationMin, deadline }) => ({
    id,
    title,
    remainingMin: durationMin,
    deadline,
  }));
}
