import { plans } from "./schema";
import { ownedBy, type WorkspaceTx } from "./workspace-transaction";

/** A planned task whose remaining time didn't fit before its deadline. */
export interface QueuedTask {
  /** The task's id, or its occurrence's. */
  id: string;
  title: string;
  remainingMin: number;
  deadline: Date;
}

export type SavedQueue = (Omit<QueuedTask, "deadline"> & { deadline: string })[];

export interface SavedPlan {
  plannedAt: Date;
  queue: QueuedTask[];
}

export async function loadPlan(tx: WorkspaceTx): Promise<SavedPlan | undefined> {
  const row = await tx.query.plans.findFirst({ where: ownedBy(tx, plans) });
  return (
    row && {
      plannedAt: row.plannedAt,
      queue: row.queue.map((task) => ({ ...task, deadline: new Date(task.deadline) })),
    }
  );
}

export async function savePlan(tx: WorkspaceTx, { plannedAt, queue }: SavedPlan): Promise<void> {
  const row = { plannedAt, queue: queue.map((task) => ({ ...task, deadline: task.deadline.toISOString() })) };
  await tx
    .insert(plans)
    .values({ workspaceId: tx.workspaceId, ...row })
    .onConflictDoUpdate({ target: plans.workspaceId, set: row });
}
