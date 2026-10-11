import "server-only";
import type { SpreadStrategy, Task } from "@/lib/items";
import { type Placement, SLOT_MIN } from "@/lib/placements";
import { CHUNK_BREAK_MIN } from "@/lib/settings";
import { addMinutes, minutesBetween } from "@/lib/time/duration";
import { type Interval, type IntervalSet, mergeIntervals, subtractIntervals } from "@/lib/time/interval";
import { orderByUrgency } from "./urgency";

const SLOT_MS = SLOT_MIN * 60_000;

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
 */
export function placeTasks(tasks: Task[], free: IntervalSet, placed: readonly Placement[] = []): PlacementResult {
  let remaining = free;
  const placements: Placement[] = [];
  const unplaced: Task[] = [];

  for (const task of orderByUrgency(tasks, remaining)) {
    const blocks =
      (task.spread === "asap" ? null : findBlocks(task, task.spread, remaining, placed)) ??
      findBlocks(task, "asap", remaining, placed);
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

/**
 * Cuts `durationMin` into as many equal chunks as `minChunkMin` allows, sizes differing by at most `SLOT_MIN`, each
 * at its earliest fit from its `evenTargets` target and at least `breakMin` after the one before. When they don't
 * all fit, tries one chunk fewer, down to as few as `maxChunkMin` allows, skipping counts whose equal sizes fall
 * outside the chunk sizes; returns `null` if none fits. Assumes
 * `durationMin` and the chunk sizes are multiples of `SLOT_MIN`.
 */
export function findEvenChunks(
  free: IntervalSet,
  durationMin: number,
  window: Interval,
  { minChunkMin, maxChunkMin }: NonNullable<Task["split"]>,
  breakMin: number,
): Interval[] | null {
  const fewest = Math.max(1, Math.ceil(durationMin / maxChunkMin));
  for (let count = Math.max(fewest, Math.floor(durationMin / minChunkMin)); count >= fewest; count--) {
    const lengths = equalSlots(durationMin, count);
    if (lengths[0] > maxChunkMin || (durationMin >= minChunkMin && lengths.at(-1)! < minChunkMin)) continue;

    const targets = evenTargets(free, window, durationMin, count);
    const chunks: Interval[] = [];
    for (const [i, lengthMin] of lengths.entries()) {
      const previous = chunks.at(-1);
      const start = later(targets[i], previous && addMinutes(previous.end, breakMin));
      const chunk = findEarliestSlot(free, lengthMin, { start, end: window.end });
      if (!chunk) break;
      chunks.push(chunk);
    }
    if (chunks.length === count) return chunks;
  }
  return null;
}

/** `durationMin` cut into `count` lengths on the `SLOT_MIN` grid, longest first, differing by at most one slot. */
function equalSlots(durationMin: number, count: number): number[] {
  const base = Math.floor(durationMin / count / SLOT_MIN) * SLOT_MIN;
  const longer = Math.floor((durationMin - base * count) / SLOT_MIN);
  const lengths = Array.from({ length: count }, (_, i) => (i < longer ? base + SLOT_MIN : base));
  // Only off the grid when `durationMin` is, e.g. time left after a partly done chunk.
  lengths[count - 1] += durationMin - lengths.reduce((sum, length) => sum + length, 0);
  return lengths;
}

/**
 * Start targets that spread `count` blocks, `durationMin` long in total, evenly over the free time in `window`: each
 * block's target centres it in its equal share of that free time, so busy stretches get fewer blocks.
 */
export function evenTargets(free: IntervalSet, window: Interval, durationMin: number, count: number): Date[] {
  const parts = free
    .map((slot) => ({ start: later(slot.start, window.start), end: slot.end < window.end ? slot.end : window.end }))
    .filter((part) => part.start < part.end);
  const shareMin = parts.reduce((sum, part) => sum + minutesBetween(part.start, part.end), 0) / count;
  const offsetMin = Math.max(0, (shareMin - durationMin / count) / 2);

  return Array.from({ length: count }, (_, k) => atFreeMinute(parts, k * shareMin + offsetMin) ?? window.start);
}

/** The time `minute` minutes of free time into `parts`, or `null` when they hold no free time. */
function atFreeMinute(parts: Interval[], minute: number): Date | null {
  let left = minute;
  for (const part of parts) {
    const length = minutesBetween(part.start, part.end);
    if (left < length) return addMinutes(part.start, left);
    left -= length;
  }
  return parts.at(-1)?.end ?? null;
}

function later(date: Date, other: Date | undefined): Date {
  return other && other > date ? other : date;
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

function ceilToSlot(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / SLOT_MS) * SLOT_MS);
}
