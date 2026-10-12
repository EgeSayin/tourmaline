import type { SpreadStrategy, Task } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import { CHUNK_BREAK_MIN, FOCUS_CAP_RAISES_MIN } from "@/lib/settings";
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
import { type FocusDay, fill, full, overCap, raiseCaps, trimToRoom } from "./focus-cap";
import { orderByUrgency } from "./urgency";

export interface PlacementResult {
  /** In placement order, most urgent first. */
  placements: Placement[];
  unplaced: Task[];
}

/**
 * Places each task, most urgent first, as its `spread` asks: at its earliest fit (`asap`), centred in its share of
 * the free time in its window (`even`, see `evenTargets`, falling back to `asap` when that finds no room) or at its
 * latest fit (`just-in-time`). A task goes in one block, or for a split task in chunks (see `findEarliestChunks`) at
 * least `CHUNK_BREAK_MIN` apart, also from its chunks in `placed`. It is placed whole or not at all.
 *
 * With focus `days`, which count what's already filled, a task first leaves out the days that are full, and cuts
 * each day its blocks would fill past its cap down to the room left (see `trimToRoom`), searching again until its
 * blocks fit under every cap. Only if that finds no room does it go over the caps, by as little as it can (see
 * `FOCUS_CAP_RAISES_MIN`).
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
      task.spread === "even"
        ? (findBlocks(task, "even", open, placed) ?? findBlocks(task, "asap", open, placed))
        : findBlocks(task, task.spread, open, placed);
    const placeUnder = (caps: FocusDay[]) => {
      for (let open = subtractIntervals(remaining, full(caps)); ;) {
        const found = place(open);
        if (!found) return null;
        const over = overCap(caps, found);
        if (over.length === 0) return found;
        open = trimToRoom(open, over, found);
      }
    };

    let blocks: Interval[] | null = null;
    for (const extraMin of FOCUS_CAP_RAISES_MIN) {
      blocks = placeUnder(raiseCaps(focus, extraMin));
      if (blocks) break;
    }
    if (blocks) {
      focus = fill(focus, blocks);
      placements.push(
        ...blocks.map((block) => ({
          taskId: task.id,
          ...block,
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
