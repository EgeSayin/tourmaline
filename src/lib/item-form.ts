import type { Item } from "./items";
import type { ByWeekday, Weekday } from "./recurrence";
import { toDateTimeInputValue } from "@/lib/time/local-time";
import { toTimeInputValue } from "@/lib/time/time-of-day";
import type { TimeZone } from "@/lib/time/time-zone";

export const REPEAT_OPTIONS = ["none", "daily", "weekly"] as const;

export type Repeat = (typeof REPEAT_OPTIONS)[number];

/** Whether a weekly item's times, or a task's duration, are the same on each of its days or each day's own. */
export const PER_DAY_OPTIONS = ["same", "each"] as const;

export type PerDay = (typeof PER_DAY_OPTIONS)[number];

/** Only a weekly item on more than one day can have its own times or duration per day. */
export const offersPerDay = (repeat: Repeat, weekdays: readonly unknown[]) =>
  repeat === "weekly" && weekdays.length > 1;

/** The form field holding field `name`'s value for one weekday, when each day has its own. */
export const dayField = (name: string, day: Weekday) => `${name}-${day}`;

/** `values` as form fields, one per weekday, each under `dayField(name, day)`. */
function dayFields<T>(name: string, values: ByWeekday<T> | null, toValue: (value: T) => string) {
  return Object.fromEntries(
    Object.entries(values ?? {}).map(([day, value]) => [dayField(name, Number(day) as Weekday), toValue(value as T)]),
  );
}

/** Until when a repeating task's occurrence may be planned: up to the next one, or only within its own period. */
export const CATCH_UP_OPTIONS = ["later", "in-period"] as const;

export type CatchUp = (typeof CATCH_UP_OPTIONS)[number];

/** How much of a repeating task's duration each occurrence gets: all of it, or what fits (see `Task.upTo`). */
export const AMOUNT_OPTIONS = ["all", "fits"] as const;

export type Amount = (typeof AMOUNT_OPTIONS)[number];

/** Whether a task's time of day is a hard limit or a preference. */
export const TIME_OF_DAY_RULES = ["prefer", "must"] as const;

export type TimeOfDayRule = (typeof TIME_OF_DAY_RULES)[number];

/** Whether a task is placed as one block or split into chunks. */
export const BLOCKS_OPTIONS = ["one", "split"] as const;

export type Blocks = (typeof BLOCKS_OPTIONS)[number];

export function itemToFormValues(item: Item, timeZone: TimeZone): Record<string, string> {
  const local = (date: Date) => toDateTimeInputValue(date, timeZone);
  const { recurrence } = item;
  const shared = {
    title: item.title,
    priority: item.priority,
    timing: item.timing,
    repeat: recurrence?.frequency ?? "none",
    interval: String(recurrence?.interval ?? 1),
    weekdays: recurrence?.frequency === "weekly" ? recurrence.weekdays.join(",") : "",
    until: recurrence?.until ?? "",
    category: item.categoryId ?? "",
    perDay: (item.timing === "fixed" ? item.dayTimes : item.dayDurations) ? "each" : "same",
  };

  if (item.timing === "fixed") {
    return {
      ...shared,
      date: local(item.start).slice(0, 10),
      startTime: local(item.start).slice(11, 16),
      endTime: local(item.end).slice(11, 16),
      ...dayFields("startTime", item.dayTimes, (time) => toTimeInputValue(time.startMinute)),
      ...dayFields("endTime", item.dayTimes, (time) => toTimeInputValue(time.endMinute)),
      location: item.location ?? "",
      bufferBeforeMin: String(item.bufferBeforeMin),
      bufferAfterMin: String(item.bufferAfterMin),
    };
  }
  return {
    ...shared,
    durationMin: String(item.durationMin),
    ...dayFields("durationMin", item.dayDurations, String),
    earliestStart: local(item.earliestStart),
    deadline: recurrence ? "" : local(item.deadline),
    blocks: item.split ? "split" : "one",
    minChunkMin: item.split ? String(item.split.minChunkMin) : "",
    maxChunkMin: item.split ? String(item.split.maxChunkMin) : "",
    breakMin: item.split ? String(item.split.breakMin) : "",
    spread: item.spread,
    amount: item.upTo ? "fits" : "all",
    catchUp: item.withinPeriod ? "in-period" : "later",
    totalMin: item.totalMin === null ? "" : String(item.totalMin),
    timeOfDayStart: item.timeOfDay ? String(item.timeOfDay.startMinute) : "",
    timeOfDayEnd: item.timeOfDay ? String(item.timeOfDay.endMinute) : "",
    timeOfDayRule: item.timeOfDay?.must ? "must" : "prefer",
  };
}

/** One occurrence's timing as its form edits it: a fixed one's date and times, a task one's duration and window. */
export function occurrenceToFormValues(occurrence: Item, timeZone: TimeZone): Record<string, string> {
  const local = (date: Date) => toDateTimeInputValue(date, timeZone);
  if (occurrence.timing === "fixed") {
    const { date, startTime, endTime } = itemToFormValues(occurrence, timeZone);
    return { date, startTime, endTime };
  }
  return {
    durationMin: String(occurrence.durationMin),
    earliestStart: local(occurrence.earliestStart),
    deadline: local(occurrence.deadline),
  };
}
