/** `planned` until checked off as `done` or marked `missed`. */
export const PLACEMENT_STATUSES = ["planned", "done", "missed"] as const;

export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

/** Where (part of) a flexible task is scheduled. Fixed items have no placements; their own times are final. */
export interface Placement {
  /** The task's id, or the occurrence's (see `occurrenceId`) for a recurring task. */
  taskId: string;
  start: Date;
  end: Date;
  /** Pinned placements are never moved by the scheduler. */
  pinned: boolean;
  status: PlacementStatus;
}

/** Identifies a placement: a task has at most one starting at any time. */
export type PlacementRef = Pick<Placement, "taskId" | "start">;

/** Re-planning may move it: planned, not pinned, and not started by `now`. */
export function isPending(placement: Placement, now: Date): boolean {
  return placement.status === "planned" && !placement.pinned && placement.start >= now;
}

/** Where a placement stands at a time: a planned one is in progress once started, and to review once ended. */
export type PlacementState = "planned" | "in-progress" | "to-review" | "done" | "missed";

export function placementState(placement: Placement, now: Date): PlacementState {
  if (placement.status !== "planned") return placement.status;
  return placement.end <= now ? "to-review" : placement.start < now ? "in-progress" : "planned";
}

/** Placements start on multiples of this many minutes, and task durations are multiples of it. */
export const SLOT_MIN = 5;
