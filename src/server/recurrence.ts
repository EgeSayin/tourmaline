import { addMinutes, minutesBetween } from "@/lib/time/duration";
import {
  dayTimeLengthMin,
  isFixed,
  isTask,
  type Item,
  itemSpan,
  type NewItem,
  type NewTask,
  withSpan,
} from "@/lib/items";
import { occurrenceId, type Recurrence, type Weekday } from "@/lib/recurrence";
import type { TimeZone } from "@/lib/time/time-zone";
import { earlier, type Interval } from "@/lib/time/interval";
import { MINUTES_PER_DAY } from "@/lib/time/time-of-day";
import { atLocalTime, localDate, startOfDay, toDate, zoned } from "@/server/time/temporal";

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

  const anchor = periodAnchor(rule, first);
  const unit = daysPerPeriod(rule);
  const offsets = rule.frequency === "daily" ? [0] : rule.weekdays.map((day) => day - 1);

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
 * moves their end instead of inverting them; a weekday with its own times or duration takes those. A recurring task's window runs from its earliest
 * start to the same time on the date the rule next occurs, even past `until` or a skipped date, or only to the end of
 * its period if that's earlier and it's `withinPeriod`; it's done if its occurrence state says so. A changed
 * occurrence has its own times instead, wherever they fall, so the result is sorted by start.
 */
export function expandOccurrences<T extends Item>(item: T, range: Interval, timeZone: TimeZone): T[] {
  if (!item.recurrence) return [item];

  const firstStart = zoned(itemSpan(item).start, timeZone);
  const first = firstStart.toPlainDate();
  const startOn = (date: Temporal.PlainDate) => toDate(firstStart.add({ days: first.until(date).days }));

  const lengthMin = isFixed(item) ? minutesBetween(item.start, item.end) : 0;
  const spanOn = (date: Temporal.PlainDate): Interval => {
    const time = isFixed(item) ? item.dayTimes?.[date.dayOfWeek as Weekday] : undefined;
    if (!time) {
      const start = startOn(date);
      return { start, end: addMinutes(start, lengthMin) };
    }
    const start = atLocalTime(date, time.startMinute, timeZone);
    return { start, end: addMinutes(start, dayTimeLengthMin(time)) };
  };
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
  const withinPeriod = isTask(item) && item.withinPeriod;
  const occurrences: T[] = [];
  const occurs = (day: string) => !(until && day > until) && item.occurrences[day] !== "skipped";
  for (const [i, date] of dates.slice(0, -1).entries()) {
    const day = date.toString();
    if (!occurs(day) || item.changes[day]) continue;

    const span = isFixed(item)
      ? spanOn(date)
      : {
          start: startOn(date),
          end: withinPeriod
            ? earlier(startOn(dates[i + 1]), startOfDay(periodEnd(item.recurrence, first, date), timeZone))
            : startOn(dates[i + 1]),
        };
    if (span.start >= range.end || span.end <= range.start) continue;

    occurrences.push(occurrenceOf(item, day, span));
  }
  for (const [day, change] of Object.entries(item.changes)) {
    if (!occurs(day) || change.start >= range.end || change.end <= range.start) continue;
    const occurrence = occurrenceOf(item, day, change);
    occurrences.push(isTask(occurrence) ? { ...occurrence, durationMin: change.durationMin! } : occurrence);
  }
  return occurrences.sort((a, b) => itemSpan(a).start.getTime() - itemSpan(b).start.getTime());
}

function occurrenceOf<T extends Item>(item: T, day: string, span: Interval): T {
  const occurrence = { ...withSpan(item, span), id: occurrenceId(item.id, day) };
  if (!isTask(occurrence)) return occurrence;
  const weekday = Temporal.PlainDate.from(day).dayOfWeek as Weekday;
  return {
    ...occurrence,
    durationMin: occurrence.dayDurations?.[weekday] ?? occurrence.durationMin,
    done: item.occurrences[day] === "done",
  };
}

/** Whether series `item` has an occurrence that goes by local date `date`, skipped or not. */
export function occursOn(item: NewItem, date: string, timeZone: TimeZone): boolean {
  if (!item.recurrence) return false;
  const day = Temporal.PlainDate.from(date);
  const first = localDate(itemSpan(item).start, timeZone);
  return occurrenceDates(item.recurrence, first, day, day.add({ days: 1 })).length > 0;
}

/**
 * The occurrence of series `item` that goes by local date `date`, as its series has it and as it is (with its change),
 * or `undefined` if there is none or it's skipped.
 */
export function occurrenceOn<T extends Item>(
  item: T,
  date: string,
  timeZone: TimeZone,
): { series: T; own: T } | undefined {
  const day = Temporal.PlainDate.from(date);
  const range = { start: startOfDay(day, timeZone), end: startOfDay(day.add({ days: 1 }), timeZone) };
  const id = occurrenceId(item.id, date);
  const unchanged = expandOccurrences({ ...item, changes: {} }, range, timeZone).find(
    (occurrence) => occurrence.id === id,
  );
  if (!unchanged) return undefined;
  const series = { ...unchanged, changes: item.changes };
  const change = item.changes[date];
  if (!change) return { series, own: series };
  const own = withSpan(series, change);
  return { series, own: isTask(own) ? { ...own, durationMin: change.durationMin! } : own };
}

/** The first occurrence of a recurring `item`, or `undefined` if it ends before occurring. */
export function firstOccurrence(item: NewItem, timeZone: TimeZone): Item | undefined {
  const stored: Item = isTask(item)
    ? { ...item, id: "", occurrences: {}, changes: {}, done: false }
    : { ...item, id: "", occurrences: {}, changes: {} };
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
  // Every period holds a date the rule could occur on, and each skip from `from` on can push the next one a period
  // further.
  const fromDate = localDate(from, timeZone).toString();
  const skips = Object.entries(item.occurrences).filter(([date, state]) => state === "skipped" && date >= fromDate);
  const periods = skips.length + count;
  const range = {
    start: from,
    end: addMinutes(from, (periods * daysPerPeriod(item.recurrence) + 1) * MINUTES_PER_DAY),
  };
  return expandOccurrences(item, range, timeZone).slice(0, count);
}

const daysPerPeriod = (rule: Recurrence) => rule.interval * (rule.frequency === "daily" ? 1 : 7);

/** Where periods start counting from: the first date for a daily rule, its week's Monday for a weekly one. */
const periodAnchor = (rule: Recurrence, first: Temporal.PlainDate) =>
  rule.frequency === "daily" ? first : first.subtract({ days: first.dayOfWeek - 1 });

/** The day after the period, `daysPerPeriod` long, that `date` falls in, for a series starting on `first`. */
function periodEnd(rule: Recurrence, first: Temporal.PlainDate, date: Temporal.PlainDate): Temporal.PlainDate {
  const anchor = periodAnchor(rule, first);
  const unit = daysPerPeriod(rule);
  return anchor.add({ days: (Math.floor(anchor.until(date).days / unit) + 1) * unit });
}
