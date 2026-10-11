import "server-only";
import { addMinutes, minutesBetween } from "@/lib/time/duration";
import { isFixed, isTask, type Item, itemSpan, type NewItem, type NewTask, withSpan } from "@/lib/items";
import { occurrenceId, type Recurrence } from "@/lib/recurrence";
import type { TimeZone } from "@/lib/time/time-zone";
import type { Interval } from "@/lib/time/interval";
import { localDate, toDate, zoned } from "@/server/time/temporal";

const MINUTES_PER_DAY = 24 * 60;

/**
 * Local dates in `[from, to)` on which a series starting on `first` occurs, in order. Nothing occurs before
 * `first` or after `rule.until`.
 */
export function occurrenceDates(
  rule: Recurrence,
  first: Temporal.PlainDate,
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
): Temporal.PlainDate[] {
  const until = rule.until ? Temporal.PlainDate.from(rule.until) : null;
  const start = Temporal.PlainDate.compare(from, first) > 0 ? from : first;
  const end = until && Temporal.PlainDate.compare(until.add({ days: 1 }), to) < 0 ? until.add({ days: 1 }) : to;
  const inRange = (date: Temporal.PlainDate) =>
    Temporal.PlainDate.compare(date, start) >= 0 && Temporal.PlainDate.compare(date, end) < 0;

  const anchor = rule.frequency === "daily" ? first : first.subtract({ days: first.dayOfWeek - 1 });
  const unit = rule.frequency === "daily" ? rule.interval : rule.interval * 7;
  const offsets = rule.frequency === "daily" ? [0] : [...rule.weekdays].sort((a, b) => a - b).map((day) => day - 1);

  const dates: Temporal.PlainDate[] = [];
  const skipped = Math.floor(anchor.until(start).days / unit);
  for (
    let period = anchor.add({ days: skipped * unit });
    Temporal.PlainDate.compare(period, end) < 0;
    period = period.add({ days: unit })
  ) {
    for (const offset of offsets) {
      const date = period.add({ days: offset });
      if (inRange(date)) dates.push(date);
    }
  }
  return dates;
}

/**
 * The occurrences of `item` that overlap `range`, in order, each with its occurrence id and times; a one-off item
 * as it is. Occurrences keep the first one's local start time; fixed ones also keep its length, so a clock change
 * moves their end instead of inverting them. A recurring task's window runs from its earliest
 * start to the same time on the date the rule next occurs, even past `until` or a skipped date, and it's done if
 * its override says so.
 */
export function expandOccurrences<T extends Item>(item: T, range: Interval, timeZone: TimeZone): T[] {
  if (!item.recurrence) return [item];

  const firstStart = zoned(itemSpan(item).start, timeZone);
  const first = firstStart.toPlainDate();
  const startOn = (date: Temporal.PlainDate) => toDate(firstStart.add({ days: first.until(date).days }));

  const lengthMin = isFixed(item) ? minutesBetween(item.start, item.end) : 0;
  const periodDays = daysPerPeriod(item.recurrence);
  // Plus a day: around a clock change, an occurrence under a day long can end two local dates after it starts.
  const spanDays = isFixed(item) ? Math.ceil(lengthMin / MINUTES_PER_DAY) + 1 : periodDays;
  const dates = occurrenceDates(
    { ...item.recurrence, until: null },
    first,
    localDate(range.start, timeZone).subtract({ days: spanDays }),
    localDate(range.end, timeZone).add({ days: 1 + periodDays }),
  );

  // The last date only bounds the window before it: dates run a full period past `range`, so it starts after it.
  const { until } = item.recurrence;
  const skipped = new Set(item.overrides.filter((override) => override.skipped).map((override) => override.date));
  const done = new Set(item.overrides.filter((override) => override.done).map((override) => override.date));
  const occurrences: T[] = [];
  for (const [i, date] of dates.slice(0, -1).entries()) {
    const day = date.toString();
    if ((until && day > until) || skipped.has(day)) continue;

    const start = startOn(date);
    const end = isFixed(item) ? addMinutes(start, lengthMin) : startOn(dates[i + 1]);
    if (start >= range.end || end <= range.start) continue;

    const occurrence = { ...withSpan(item, { start, end }), id: occurrenceId(item.id, day) };
    occurrences.push(isTask(occurrence) ? { ...occurrence, done: done.has(day) } : occurrence);
  }
  return occurrences;
}

/** The first occurrence of a recurring `item`, or `undefined` if it ends before occurring. */
export function firstOccurrence(item: NewItem, timeZone: TimeZone): Item | undefined {
  const stored: Item = isTask(item)
    ? { ...item, id: "", overrides: [], done: false }
    : { ...item, id: "", overrides: [] };
  return nextOccurrence(stored, itemSpan(item).start, timeZone);
}

/**
 * Recurring `task` with the deadline it's stored with: its first occurrence's, where the rule next occurs.
 * `undefined` if the series ends before it first occurs.
 */
export function withFirstDeadline<T extends NewTask>(task: Omit<T, "deadline">, timeZone: TimeZone): T | undefined {
  const first = firstOccurrence({ ...task, deadline: task.earliestStart } as T, timeZone);
  return first && ({ ...task, deadline: itemSpan(first).end } as T);
}

/** The first occurrence of a recurring `item` that ends after `from`, or `undefined` if none does. */
export function nextOccurrence(item: Item, from: Date, timeZone: TimeZone): Item | undefined {
  return upcomingOccurrences(item, from, 1, timeZone)[0];
}

/**
 * The first `count` occurrences of a recurring `item` that end after `from`, in order, or as many as there are;
 * none for a one-off item.
 */
export function upcomingOccurrences<T extends Item>(item: T, from: Date, count: number, timeZone: TimeZone): T[] {
  if (!item.recurrence) return [];
  // Every period holds a date the rule could occur on, and each skip can push the next one a period further.
  const periods = item.overrides.filter((override) => override.skipped).length + count;
  const range = {
    start: from,
    end: addMinutes(from, (periods * daysPerPeriod(item.recurrence) + 1) * MINUTES_PER_DAY),
  };
  return expandOccurrences(item, range, timeZone).slice(0, count);
}

const daysPerPeriod = (rule: Recurrence) => rule.interval * (rule.frequency === "daily" ? 1 : 7);
