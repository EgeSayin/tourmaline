import type { ChunkSizes } from "@/lib/items";
import { SLOT_MIN } from "@/lib/placements";
import { addMinutes, minutesBetween } from "@/lib/time/duration";
import { clipIntervals, type Interval, type IntervalSet, later, mergeIntervals } from "@/lib/time/interval";

const SLOT_MS = SLOT_MIN * 60_000;

/**
 * Returns the earliest `durationMin`-long block inside both a `free` interval and `window`, starting on the
 * `SLOT_MIN` grid, or `null` if none fits.
 */
export function findEarliestSlot(free: IntervalSet, durationMin: number, window: Interval): Interval | null {
  for (const slot of clipIntervals(free, window)) {
    const start = ceilToSlot(slot.start);
    if (minutesBetween(start, slot.end) >= durationMin) {
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
  { minChunkMin, maxChunkMin }: ChunkSizes,
  breakMin: number,
): Interval[] | null {
  const chunks: Interval[] = [];
  let remaining = durationMin;
  let earliest = window.start;

  for (const { start: slotStart, end } of clipIntervals(free, window)) {
    let start = ceilToSlot(later(slotStart, earliest));
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
  split: ChunkSizes,
  breakMin: number,
): Interval[] | null {
  const chunks = findEarliestChunks(mirrorAll(free), durationMin, mirror(window), split, breakMin);
  return chunks && chunks.map(mirror).reverse();
}

/**
 * Cuts `durationMin` into as many equal chunks as `minChunkMin` allows, sizes differing by at most `SLOT_MIN`, each
 * at its earliest fit from its `evenTargets` target and at least `breakMin` after the one before. When they don't
 * all fit, tries one chunk fewer, down to as few as `maxChunkMin` allows, skipping counts whose equal sizes fall
 * outside the chunk sizes; returns `null` if none fits. Assumes `durationMin` and the chunk sizes are multiples of
 * `SLOT_MIN`.
 */
export function findEvenChunks(
  free: IntervalSet,
  durationMin: number,
  window: Interval,
  { minChunkMin, maxChunkMin }: ChunkSizes,
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
      const start = previous ? later(targets[i], addMinutes(previous.end, breakMin)) : targets[i];
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
  const parts = clipIntervals(free, window);
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
