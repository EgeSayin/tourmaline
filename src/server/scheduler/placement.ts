import type { SpreadStrategy } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import { addMinutes } from "@/lib/time/duration";
import { type Interval, type IntervalSet, intersectIntervals, subtractIntervals } from "@/lib/time/interval";
import {
  evenTargets,
  findEarliestChunks,
  findEarliestSlot,
  findEvenChunks,
  findLatestChunks,
  findLatestSlot,
} from "./search";
import { type PlanTask, taskWindow } from "./task-time";
import { byUrgency, type TaskOrder } from "./urgency";

/** How to place tasks: in which order, and whether to rank the rest again after each placement. */
export interface PlanStrategy {
  order: TaskOrder;
  /** Ranks the tasks left again, against the free time then left, after each placement; otherwise only once. */
  reorder: boolean;
}

/** The plan as first tried: tasks most urgent first, by the pressure they start with. */
export const BY_URGENCY: PlanStrategy = { order: byUrgency, reorder: false };

export interface PlacementResult {
  /** In placement order. */
  placements: Placement[];
  unplaced: PlanTask[];
}

/**
 * Places each task, in `strategy`'s order, as its `spread` asks: at its earliest fit (`asap`), centred in its share of
 * the free time in its window (`even`, see `evenTargets`, falling back to `asap` when that finds no room) or at its
 * latest fit (`just-in-time`). A task goes in one block, or for a split task in chunks (see `findEarliestChunks`) at
 * least its split's `breakMin` apart, also from its chunks in `placed`. It is placed whole or not at all, except for an
 * `upTo` one: it gives up a shortest chunk at a time until it fits, and is never left unplaced.
 */
export function placeTasks(
  tasks: PlanTask[],
  free: IntervalSet,
  placed: readonly Placement[] = [],
  strategy: PlanStrategy = BY_URGENCY,
): PlacementResult {
  let remaining = free;
  const placements: Placement[] = [];
  const unplaced: PlanTask[] = [];

  for (let queue = strategy.order(tasks, remaining); queue.length > 0;) {
    const [task, ...rest] = queue;
    const blocks = task.upTo ? findMostBlocks(task, remaining, placed) : findTaskBlocks(task, remaining, placed);
    if (blocks) {
      placements.push(
        ...blocks.map((block) => ({
          taskId: task.id,
          ...block,
          pinned: false,
          status: "planned" as const,
        })),
      );
      remaining = subtractIntervals(remaining, blocks);
    } else if (!task.upTo) {
      unplaced.push(task);
    }
    queue = strategy.reorder ? strategy.order(rest, remaining) : rest;
  }
  return { placements, unplaced };
}

/**
 * `task`'s blocks in `free`, giving up its preferences in turn, least important first, until they fit: its spread
 * (the others are tried after it: `even` can find no room from its targets, and when a block's length is off the
 * grid, as time left after an early check-off can be, a start on the grid fits where an end on it doesn't, or the
 * other way round), then the time it keeps to (see `PlanTask.searchOrder`).
 */
function findTaskBlocks(task: PlanTask, free: IntervalSet, placed: readonly Placement[]): Interval[] | null {
  const spreads = [...new Set<SpreadStrategy>([task.spread, "asap", "just-in-time"])];
  for (const time of task.searchOrder) {
    const open = intersectIntervals(free, time);
    for (const spread of spreads) {
      const found = findBlocks(task, spread, open, placed);
      if (found) return found;
    }
  }
  return null;
}

/** Blocks for as much of `task` as fits: all of it, then whole shortest chunks (none for one block), most first. */
function findMostBlocks(task: PlanTask, free: IntervalSet, placed: readonly Placement[]): Interval[] | null {
  const step = Math.min(task.split?.minChunkMin ?? task.durationMin, task.durationMin);
  const shorter = Array.from({ length: Math.ceil(task.durationMin / step) - 1 }, (_, i) => (i + 1) * step).reverse();
  for (const durationMin of [task.durationMin, ...shorter]) {
    const found = findTaskBlocks({ ...task, durationMin }, free, placed);
    if (found) return found;
  }
  return null;
}

/** `task`'s blocks in `free`, which it may all use, as `spread` asks. */
function findBlocks(
  task: PlanTask,
  spread: SpreadStrategy,
  free: IntervalSet,
  placed: readonly Placement[],
): Interval[] | null {
  const { id, durationMin, split } = task;
  const window = taskWindow(task);
  if (!split) {
    const slot =
      spread === "just-in-time"
        ? findLatestSlot(free, durationMin, window)
        : findEarliestSlot(
            free,
            durationMin,
            spread === "even" ? { start: evenTargets(free, window, durationMin, 1)[0], end: window.end } : window,
          );
    return slot && [slot];
  }

  const breaks = placed
    .filter((placement) => placement.taskId === id)
    .map((placement) => ({
      start: addMinutes(placement.start, -split.breakMin),
      end: addMinutes(placement.end, split.breakMin),
    }));
  const open = subtractIntervals(free, breaks);
  const find = spread === "even" ? findEvenChunks : spread === "just-in-time" ? findLatestChunks : findEarliestChunks;
  return find(open, durationMin, window, split, split.breakMin);
}
