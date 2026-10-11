import "server-only";
import type { Task } from "@/lib/items";
import { type Placement, SLOT_MIN } from "@/lib/placements";
import { CHUNK_BREAK_MIN } from "@/lib/settings";
import { addMinutes, minutesBetween } from "@/lib/time/duration";
import { type Interval, type IntervalSet, mergeIntervals, subtractIntervals } from "@/lib/time/interval";
import type { TimeZone } from "@/lib/time/time-zone";
import { dailyIntervals } from "./free-time";
import { orderByUrgency } from "./urgency";

const SLOT_MS = SLOT_MIN * 60_000;

export interface PlacementResult {
  /** In placement order, most urgent first. */
  placements: Placement[];
  unplaced: Task[];
}

/**
 * Places each task, most urgent first, inside its preferred windows if it fits there, or else anywhere in its window:
 * as one block, or for a split task as chunks (see `findEarliestChunks`) at least `CHUNK_BREAK_MIN` apart, also
 * from its chunks in `placed`. A task is placed whole or not at all.
 */
export function placeTasks(
  tasks: Task[],
  free: IntervalSet,
  timeZone: TimeZone,
  placed: readonly Placement[] = [],
): PlacementResult {
  let remaining = free;
  const placements: Placement[] = [];
  const unplaced: Task[] = [];

  for (const task of orderByUrgency(tasks, remaining)) {
    const blocks = findBlocks(task, remaining, timeZone, placed);
    if (blocks) {
      placements.push(
        ...blocks.map((block) => ({ taskId: task.id, ...block, source: "auto" as const, pinned: false })),
      );
      remaining = subtractIntervals(remaining, blocks);
    } else {
      unplaced.push(task);
    }
  }
  return { placements, unplaced };
}

function findBlocks(
  task: Task,
  free: IntervalSet,
  timeZone: TimeZone,
  placed: readonly Placement[],
): Interval[] | null {
  const window = { start: task.earliestStart, end: task.deadline };
  const { split } = task;
  const breaks = placed
    .filter((placement) => split && placement.taskId === task.id)
    .map((placement) => ({
      start: addMinutes(placement.start, -CHUNK_BREAK_MIN),
      end: addMinutes(placement.end, CHUNK_BREAK_MIN),
    }));
  const find = (time: IntervalSet): Interval[] | null => {
    if (split)
      return findEarliestChunks(subtractIntervals(time, breaks), task.durationMin, window, split, CHUNK_BREAK_MIN);
    const slot = findEarliestSlot(time, task.durationMin, window);
    return slot && [slot];
  };
  return find(preferredTime(free, task, timeZone)) ?? find(free);
}

/**
 * Returns the earliest `durationMin`-long block inside both a `free` interval and `window`, starting on the
 * `SLOT_MIN` grid, or `null` if none fits.
 */
export function findEarliestSlot(free: IntervalSet, durationMin: number, window: Interval): Interval | null {
  for (const slot of free) {
    const start = ceilToSlot(slot.start > window.start ? slot.start : window.start);
    const end = slot.end < window.end ? slot.end : window.end;
    if (minutesBetween(start, end) >= durationMin) {
      return { start, end: addMinutes(start, durationMin) };
    }
  }
  return null;
}

/** Like `findEarliestSlot`, but the latest block, ending on the grid. */
export function findLatestSlot(free: IntervalSet, durationMin: number, window: Interval): Interval | null {
  const slot = findEarliestSlot(mirrorAll(free), durationMin, mirror(window));
  return slot && mirror(slot);
}

/**
 * Greedily cuts `durationMin` into chunks inside both `free` and `window`, earliest first, each on the `SLOT_MIN`
 * grid and at least `breakMin` after the one before. Chunks are `minChunkMin` to `maxChunkMin` long; only when
 * `durationMin` is less than `minChunkMin` is the single chunk shorter. Returns `null` unless all of it fits.
 * Assumes `durationMin` and the chunk sizes are multiples of `SLOT_MIN`, so every chunk ends on the grid too.
 */
export function findEarliestChunks(
  free: IntervalSet,
  durationMin: number,
  window: Interval,
  { minChunkMin, maxChunkMin }: NonNullable<Task["split"]>,
  breakMin: number,
): Interval[] | null {
  const chunks: Interval[] = [];
  let remaining = durationMin;
  let earliest = window.start;

  for (const slot of free) {
    const end = slot.end < window.end ? slot.end : window.end;
    let start = ceilToSlot(slot.start > earliest ? slot.start : earliest);
    while (remaining > 0 && start < end) {
      const available = Math.floor(minutesBetween(start, end) / SLOT_MIN) * SLOT_MIN;
      let length = Math.min(maxChunkMin, remaining, available);
      // Leave enough for a full last chunk.
      if (remaining - length > 0 && remaining - length < minChunkMin) length = remaining - minChunkMin;
      if (length < minChunkMin && length !== remaining) break;

      const chunk = { start, end: addMinutes(start, length) };
      chunks.push(chunk);
      remaining -= length;
      earliest = addMinutes(chunk.end, breakMin);
      start = ceilToSlot(earliest);
    }
    if (remaining === 0) return chunks;
  }
  return null;
}

/** Like `findEarliestChunks`, but the latest chunks, cut from the end, in time order. */
export function findLatestChunks(
  free: IntervalSet,
  durationMin: number,
  window: Interval,
  split: NonNullable<Task["split"]>,
  breakMin: number,
): Interval[] | null {
  const chunks = findEarliestChunks(mirrorAll(free), durationMin, mirror(window), split, breakMin);
  return chunks && chunks.map(mirror).reverse();
}

/** `interval` with time running backwards, so searching the mirror for the earliest fit finds the latest. */
function mirror({ start, end }: Interval): Interval {
  return { start: new Date(-end.getTime()), end: new Date(-start.getTime()) };
}

function mirrorAll(intervals: IntervalSet): IntervalSet {
  return mergeIntervals(intervals.map(mirror));
}

/** The part of `free` inside the task's preferred windows; all of `free` when it has none. */
function preferredTime(free: IntervalSet, task: Task, timeZone: TimeZone): IntervalSet {
  if (task.preferredWindows.length === 0) return free;
  const window = { start: task.earliestStart, end: task.deadline };
  const preferred = task.preferredWindows.flatMap((daily) => dailyIntervals(window, daily, timeZone));
  return subtractIntervals(free, subtractIntervals([window], preferred));
}

function ceilToSlot(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / SLOT_MS) * SLOT_MS);
}
