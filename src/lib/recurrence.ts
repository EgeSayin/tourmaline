/** ISO weekday numbers, Monday first. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export type Weekday = (typeof WEEKDAYS)[number];

interface BaseRecurrence {
  interval: number;
  /** Last local date an occurrence may fall on (`YYYY-MM-DD`), or `null` to repeat forever. */
  until: string | null;
}

export type Recurrence =
  | (BaseRecurrence & { frequency: "daily" })
  | (BaseRecurrence & {
      frequency: "weekly";
      /**
       * Non-empty, sorted, without duplicates. Occurrences fall only on these days, in every `interval`-th week from
       * the first date's week.
       */
      weekdays: Weekday[];
    });

export const OCCURRENCE_STATES = ["skipped", "done"] as const;

/** What happened to one occurrence of a recurring item; one that occurs as planned has no state. */
export type OccurrenceState = (typeof OCCURRENCE_STATES)[number];

/** The states of a recurring item's occurrences, by local date (`YYYY-MM-DD`). */
export type Occurrences = Record<string, OccurrenceState>;

/**
 * One occurrence's own timing in place of its series': a fixed occurrence's start and end, or a task occurrence's
 * window and duration (`null` for a fixed one). It may fall on another date, and still goes by its own.
 */
export interface OccurrenceChange {
  start: Date;
  end: Date;
  durationMin: number | null;
}

/** The changed occurrences of a recurring item, by the local date each goes by. */
export type OccurrenceChanges = Record<string, OccurrenceChange>;

const OCCURRENCE_SEPARATOR = "@";

/** The id an occurrence of a recurring item goes by, e.g. in placements; unique per item and local date. */
export function occurrenceId(itemId: string, date: string): string {
  return `${itemId}${OCCURRENCE_SEPARATOR}${date}`;
}

export function parseOccurrenceId(id: string): { itemId: string; date: string | null } {
  const [itemId, date = null] = id.split(OCCURRENCE_SEPARATOR);
  return { itemId, date };
}
