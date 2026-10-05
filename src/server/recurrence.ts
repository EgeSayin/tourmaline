import "server-only";
import type { Recurrence } from "@/lib/recurrence";

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
