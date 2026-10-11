/** ISO weekday numbers, Monday first. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export type Weekday = (typeof WEEKDAYS)[number];

interface BaseRecurrence {
  /** Repeat every `interval` days or weeks; at least 1. */
  interval: number;
  /** Last local date an occurrence may fall on (`YYYY-MM-DD`), or `null` to repeat forever. */
  until: string | null;
}

export type Recurrence =
  | (BaseRecurrence & { frequency: "daily" })
  | (BaseRecurrence & {
      frequency: "weekly";
      /** Non-empty. Occurrences fall only on these days, in every `interval`-th week from the first date's week. */
      weekdays: Weekday[];
    });

/** What differs about one occurrence of a recurring item. */
export interface OccurrenceOverride {
  /** The occurrence's local date, `YYYY-MM-DD`. */
  date: string;
  skipped: boolean;
  /** For a task's occurrence: marked done as a whole. */
  done: boolean;
}

const OCCURRENCE_SEPARATOR = "@";

/** The id an occurrence of a recurring item goes by, e.g. in placements; unique per item and local date. */
export function occurrenceId(itemId: string, date: string): string {
  return `${itemId}${OCCURRENCE_SEPARATOR}${date}`;
}

/** The item and local date (`null` for a one-off item) behind an item or occurrence id. */
export function parseOccurrenceId(id: string): { itemId: string; date: string | null } {
  const [itemId, date = null] = id.split(OCCURRENCE_SEPARATOR);
  return { itemId, date };
}
