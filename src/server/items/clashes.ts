import "server-only";
import { type FixedItem, isFixed, type Item } from "@/lib/items";
import { RECURRENCE_LOOKAHEAD_DAYS } from "@/lib/settings";
import { addMinutes } from "@/lib/time/duration";
import { later, overlaps } from "@/lib/time/interval";
import type { TimeZone } from "@/lib/time/time-zone";
import { expandOccurrences } from "@/server/recurrence";

const MINUTES_PER_DAY = 24 * 60;

/** Another fixed item, or one of its occurrences, that a fixed item would overlap. */
export interface Clash {
  /** The other item's id, or its occurrence's. */
  id: string;
  title: string;
  start: Date;
  end: Date;
  /** A mandatory item can't be bumped. */
  mandatory: boolean;
}

/**
 * The occurrences among `others` that `item`'s own occurrences overlap, sorted by start, each listed once. Only
 * occurrences that end after `now` count, a series' up to `RECURRENCE_LOOKAHEAD_DAYS` ahead; bumped ones on either
 * side, and `item`'s own (by id), don't. Buffers don't count: only the items' own times.
 */
export function findClashes(item: FixedItem, others: Item[], now: Date, timeZone: TimeZone): Clash[] {
  const range = {
    start: now,
    end: item.recurrence ? addMinutes(later(now, item.start), RECURRENCE_LOOKAHEAD_DAYS * MINUTES_PER_DAY) : item.end,
  };
  if (range.end <= range.start) return [];

  const occurrences = expandOccurrences(item, range, timeZone).filter((occurrence) => !occurrence.bumped);
  const clashes = others
    .filter((other): other is FixedItem => isFixed(other) && other.id !== item.id)
    .flatMap((other) => expandOccurrences(other, range, timeZone))
    .filter((other) => !other.bumped && other.end > now && occurrences.some((own) => overlaps(own, other)));

  return clashes
    .map(({ id, title, start, end, priority }) => ({ id, title, start, end, mandatory: priority === "mandatory" }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
