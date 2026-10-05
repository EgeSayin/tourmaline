import "server-only";
import { minutesBetween } from "@/lib/duration";
import type { Item } from "@/lib/items";
import { occurrenceId, type Recurrence } from "@/lib/recurrence";
import type { TimeZone } from "@/lib/time-zone";
import type { Interval } from "@/server/scheduler/intervals";
import { toDate } from "@/server/temporal";

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
 * as it is. Occurrences keep the first one's local times of day. A recurring task's window runs from its earliest
 * start to the same time on the date the rule next occurs, even past `until` or a skipped date.
 */
export function expandOccurrences(item: Item, range: Interval, timeZone: TimeZone): Item[] {
  if (!item.recurrence) return [item];

  const zoned = (date: Date) => Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(timeZone);
  const first = zoned(item.timing === "fixed" ? item.start : item.earliestStart).toPlainDate();
  const onDate = (time: Date, date: Temporal.PlainDate) => toDate(zoned(time).add({ days: first.until(date).days }));

  const periodDays = item.recurrence.interval * (item.recurrence.frequency === "daily" ? 1 : 7);
  // Plus a day: around a clock change, an occurrence under a day long can end two local dates after it starts.
  const spanDays =
    item.timing === "fixed" ? Math.ceil(minutesBetween(item.start, item.end) / MINUTES_PER_DAY) + 1 : periodDays;
  const dates = occurrenceDates(
    { ...item.recurrence, until: null },
    first,
    zoned(range.start).toPlainDate().subtract({ days: spanDays }),
    zoned(range.end)
      .toPlainDate()
      .add({ days: 1 + periodDays }),
  );

  // The last date only bounds the window before it: dates run a full period past `range`, so it starts after it.
  const { until } = item.recurrence;
  const occurrences: Item[] = [];
  for (const [i, date] of dates.slice(0, -1).entries()) {
    const day = date.toString();
    if ((until && day > until) || item.skippedDates.includes(day)) continue;

    const id = occurrenceId(item.id, day);
    const occurrence: Item =
      item.timing === "fixed"
        ? { ...item, id, start: onDate(item.start, date), end: onDate(item.end, date) }
        : {
            ...item,
            id,
            earliestStart: onDate(item.earliestStart, date),
            deadline: onDate(item.earliestStart, dates[i + 1]),
          };
    const { start, end } = timeSpan(occurrence);
    if (start < range.end && end > range.start) occurrences.push(occurrence);
  }
  return occurrences;
}

const timeSpan = (item: Item): Interval =>
  item.timing === "fixed" ? { start: item.start, end: item.end } : { start: item.earliestStart, end: item.deadline };
