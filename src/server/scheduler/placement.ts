import type { SpreadStrategy, Task } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import { CHUNK_BREAK_MIN } from "@/lib/settings";
import { addMinutes } from "@/lib/time/duration";
import { type Interval, type IntervalSet, subtractIntervals } from "@/lib/time/interval";
import {
  evenTargets,
  findEarliestChunks,
  findEarliestSlot,
  findEvenChunks,
  findLatestChunks,
  findLatestSlot,
} from "./search";
import { type FocusDay, fill, full, overCap } from "./focus-cap";
import { orderByUrgency } from "./urgency";

export interface PlacementResult {
  /** In placement order, most urgent first. */
  placements: Placement[];
  unplaced: Task[];
}

/**
 * Places each task, most urgent first, as its `spread` asks: at its earliest fit (`asap`), centred in its share of
 * the free time in its window (`even`, see `evenTargets`) or at its latest fit (`just-in-time`), falling back to
 * `asap` when that finds no room. A task goes in one block, or for a split task in chunks (see
 * `findEarliestChunks`) at least `CHUNK_BREAK_MIN` apart, also from its chunks in `placed`. It is placed whole or
 * not at all.
 *
 * With focus `days`, which count what's already filled, a task first leaves out the days that are full, and each
 * day its blocks would fill past its cap, searching again until its blocks fit under every cap. Only if that finds
 * no room does it go over the caps.
 */
export function placeTasks(
  tasks: Task[],
  free: IntervalSet,
  placed: readonly Placement[] = [],
  days: FocusDay[] = [],
): PlacementResult {
  let remaining = free;
  let focus = days;
  const placements: Placement[] = [];
  const unplaced: Task[] = [];

  for (const task of orderByUrgency(tasks, remaining)) {
    const place = (open: IntervalSet) =>
      (task.spread === "asap" ? null : findBlocks(task, task.spread, open, placed)) ??
      findBlocks(task, "asap", open, placed);

    let underCaps: Interval[] | null = null;
    for (let open = subtractIntervals(remaining, full(focus)); !underCaps;) {
      const found = place(open);
      if (!found) break;
      const over = overCap(focus, found);
      if (over.length === 0) underCaps = found;
      else open = subtractIntervals(open, over);
    }
    const blocks = underCaps ?? place(remaining);
    if (blocks) {
      focus = fill(focus, blocks);
      placements.push(
        ...blocks.map((block) => ({
          taskId: task.id,
          ...block,
          source: "auto" as const,
          pinned: false,
          status: "planned" as const,
        })),
      );
      remaining = subtractIntervals(remaining, blocks);
    } else {
      unplaced.push(task);
    }
  }
  return { placements, unplaced };
}

function findBlocks(
  { id, durationMin, earliestStart, deadline, split }: Task,
  spread: SpreadStrategy,
  free: IntervalSet,
  placed: readonly Placement[],
): Interval[] | null {
  const window = { start: earliestStart, end: deadline };
  if (!split) {
    const slot =
      spread === "just-in-time"
        ? findLatestSlot(free, durationMin, window)
        : findEarliestSlot(
            free,
            durationMin,
            spread === "even" ? { start: evenTargets(free, window, durationMin, 1)[0], end: deadline } : window,
          );
    return slot && [slot];
  }

  const breaks = placed
    .filter((placement) => placement.taskId === id)
    .map((placement) => ({
      start: addMinutes(placement.start, -CHUNK_BREAK_MIN),
      end: addMinutes(placement.end, CHUNK_BREAK_MIN),
    }));
  const open = subtractIntervals(free, breaks);
  const find = spread === "even" ? findEvenChunks : spread === "just-in-time" ? findLatestChunks : findEarliestChunks;
  return find(open, durationMin, window, split, CHUNK_BREAK_MIN);
}
