import type { FocusCaps } from "@/lib/settings";
import { addMinutes, minutesBetween } from "@/lib/time/duration";
import { clipIntervals, type Interval, type IntervalSet, mergeIntervals, subtractIntervals } from "@/lib/time/interval";
import type { TimeZone } from "@/lib/time/time-zone";
import { localDate, startOfDay } from "@/server/time/temporal";

/** A local day with its focus cap and the minutes already filled. */
export interface FocusDay extends Interval {
  date: string;
  capMin: number | null;
  usedMin: number;
}

/**
 * The whole local days overlapping `range`, in order, each with its cap from `focusCaps` and the minutes of it that
 * `busy` covers, overlaps counted once.
 */
export function focusDays(range: Interval, busy: Interval[], focusCaps: FocusCaps, timeZone: TimeZone): FocusDay[] {
  const days: FocusDay[] = [];
  if (range.end <= range.start) return days;
  const merged = mergeIntervals(busy);
  for (let day = localDate(range.start, timeZone); ; day = day.add({ days: 1 })) {
    const start = startOfDay(day, timeZone);
    if (start >= range.end) break;
    const interval = { start, end: startOfDay(day.add({ days: 1 }), timeZone) };
    days.push({
      ...interval,
      date: day.toString(),
      capMin: focusCaps[day.dayOfWeek - 1],
      usedMin: minutesWithin(merged, interval),
    });
  }
  return days;
}

/** `days` with `blocks`, which don't overlap what the days already count, filled in too. */
export function fill(days: FocusDay[], blocks: Interval[]): FocusDay[] {
  return days.map((day) => ({ ...day, usedMin: day.usedMin + minutesWithin(blocks, day) }));
}

/** The days among `days` already filled up to their cap. */
export function full(days: FocusDay[]): FocusDay[] {
  return days.filter((day) => day.capMin !== null && day.usedMin >= day.capMin);
}

/** The days among `days` that `blocks` fill some of and would fill past their cap. */
export function overCap(days: FocusDay[], blocks: Interval[]): FocusDay[] {
  return days.filter((day) => {
    const added = minutesWithin(blocks, day);
    return day.capMin !== null && added > 0 && day.usedMin + added > day.capMin;
  });
}

/** The minutes `days` are filled past their caps, all together. */
export function overCapMinutes(days: FocusDay[]): number {
  return days.reduce((sum, day) => sum + (day.capMin === null ? 0 : Math.max(0, day.usedMin - day.capMin)), 0);
}

/** `days` with their caps raised by `extraMin`. */
export function raiseCaps(days: FocusDay[], extraMin: number): FocusDay[] {
  return days.map((day) => (day.capMin === null ? day : { ...day, capMin: day.capMin + extraMin }));
}

/**
 * `free` with each of `days`, which `blocks` fill past its cap, cut down to the minutes left under its cap, counted
 * from where `blocks` first fill it; a search in it then fills none of them past its cap.
 */
export function trimToRoom(free: IntervalSet, days: FocusDay[], blocks: Interval[]): IntervalSet {
  const room: Interval[] = [];
  for (const day of days) {
    let roomMin = day.capMin! - day.usedMin;
    const from = clipIntervals(blocks, day).reduce(
      (first, block) => (block.start < first ? block.start : first),
      day.end,
    );
    for (const part of clipIntervals(free, { start: from, end: day.end })) {
      if (roomMin <= 0) break;
      const minutes = Math.min(roomMin, minutesBetween(part.start, part.end));
      room.push({ start: part.start, end: addMinutes(part.start, minutes) });
      roomMin -= minutes;
    }
  }
  return mergeIntervals([...subtractIntervals(free, days), ...room]);
}

function minutesWithin(intervals: readonly Interval[], window: Interval): number {
  return clipIntervals(intervals, window).reduce((sum, part) => sum + minutesBetween(part.start, part.end), 0);
}
