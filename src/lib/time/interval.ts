/** `end` is exclusive. */
export interface Interval {
  start: Date;
  end: Date;
}

declare const normalized: unique symbol;

/**
 * Intervals sorted by start, none empty, with gaps between them. Only `mergeIntervals`, `subtractIntervals` and
 * `clipIntervals` produce one, so code that scans free time in order can require it.
 */
export type IntervalSet = readonly Interval[] & { readonly [normalized]: true };

/** `intervals` merged where they overlap or touch; empty ones are left out. */
export function mergeIntervals(intervals: readonly Interval[]): IntervalSet {
  const sorted = intervals
    .filter((interval) => interval.start < interval.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
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

export function subtractIntervals(free: readonly Interval[], busy: readonly Interval[]): IntervalSet {
  const blocks = mergeIntervals(busy);
  const result: Interval[] = [];

  // Both are sorted, so the blocks that ended before a slot also end before every later one.
  let first = 0;
  for (const slot of mergeIntervals(free)) {
    while (first < blocks.length && blocks[first].end <= slot.start) first++;
    let cursor = slot.start;
    for (let i = first; i < blocks.length && blocks[i].start < slot.end; i++) {
      if (blocks[i].start > cursor) result.push({ start: cursor, end: blocks[i].start });
      cursor = blocks[i].end;
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

/** Whether `a` and `b` share any time; touching ends don't. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** The parts of `intervals` inside `window`, in their order; clipping a set gives a set. */
export function clipIntervals(intervals: IntervalSet, window: Interval): IntervalSet;
export function clipIntervals(intervals: readonly Interval[], window: Interval): Interval[];
export function clipIntervals(intervals: readonly Interval[], window: Interval): readonly Interval[] {
  return intervals
    .map((interval) => ({ start: later(interval.start, window.start), end: earlier(interval.end, window.end) }))
    .filter((interval) => interval.start < interval.end);
}
