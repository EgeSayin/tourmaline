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
