/** `end` is exclusive. */
export interface Interval {
  start: Date;
  end: Date;
}

declare const normalized: unique symbol;

/**
 * Intervals sorted by start, with gaps between them. Only `mergeIntervals` and `subtractIntervals` produce one, so
 * code that scans free time in order can require it.
 */
export type IntervalSet = readonly Interval[] & { readonly [normalized]: true };

/** Returns the intervals sorted by start, with overlapping or touching ones merged. */
export function mergeIntervals(intervals: readonly Interval[]): IntervalSet {
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [];

  for (const current of sorted) {
    const last = merged.at(-1);
    if (last && current.start <= last.end) {
      if (current.end > last.end) last.end = current.end;
    } else {
      merged.push({ ...current });
    }
  }
  return merged as unknown as IntervalSet;
}

/** Returns the parts of `free` not covered by `busy`, sorted by start. */
export function subtractIntervals(free: readonly Interval[], busy: readonly Interval[]): IntervalSet {
  const blocks = mergeIntervals(busy);
  const result: Interval[] = [];

  for (const slot of mergeIntervals(free)) {
    let cursor = slot.start;
    for (const block of blocks) {
      if (block.end <= cursor) continue;
      if (block.start >= slot.end) break;
      if (block.start > cursor) result.push({ start: cursor, end: block.start });
      cursor = block.end;
    }
    if (cursor < slot.end) result.push({ start: cursor, end: slot.end });
  }
  return result as unknown as IntervalSet;
}

export function earlier(date: Date, other: Date): Date {
  return other < date ? other : date;
}

export function later(date: Date, other: Date): Date {
  return other > date ? other : date;
}

/** The parts of `intervals` inside `window`, in their order, leaving out those that fall outside it. */
export function clipIntervals(intervals: readonly Interval[], window: Interval): Interval[] {
  return intervals
    .map((interval) => ({ start: later(interval.start, window.start), end: earlier(interval.end, window.end) }))
    .filter((interval) => interval.start < interval.end);
}
