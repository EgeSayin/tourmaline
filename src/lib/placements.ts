/** `auto`: chosen by the scheduler. `manual`: placed by the user. */
export const PLACEMENT_SOURCES = ["auto", "manual"] as const;

export type PlacementSource = (typeof PLACEMENT_SOURCES)[number];

/** Where (part of) a flexible task is scheduled. Fixed items have no placements; their own times are final. */
export interface Placement {
  /** The task's id, or the occurrence's (see `occurrenceId`) for a recurring task. */
  taskId: string;
  start: Date;
  end: Date;
  source: PlacementSource;
  /** Pinned placements are never moved by the scheduler. */
  pinned: boolean;
  /** Checked off as done. */
  done: boolean;
}

/** Re-planning may move it: not pinned, not done, and not started by `now`. */
export function isPending(placement: Placement, now: Date): boolean {
  return !placement.pinned && !placement.done && placement.start >= now;
}

/** Ended by `now` without being checked off, so its time is planned again. */
export function isMissed(placement: Placement, now: Date): boolean {
  return !placement.done && placement.end <= now;
}

/** Placements start on multiples of this many minutes, and task durations are multiples of it. */
export const SLOT_MIN = 5;
