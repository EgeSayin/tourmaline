import "server-only";

/** `end` is exclusive. */
export interface Interval {
  start: Date;
  end: Date;
}

/** Returns the intervals sorted by start, with overlapping or touching ones merged. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
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
  return merged;
}

/** Returns the parts of `free` not covered by `busy`, sorted by start. */
export function subtractIntervals(free: Interval[], busy: Interval[]): Interval[] {
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
  return result;
}
