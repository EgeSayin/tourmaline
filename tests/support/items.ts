import fc from "fast-check";
import {
  type FixedItem,
  type Task,
  type Item,
  type NewItem,
  PRIORITIES,
  type Priority,
  SPREAD_STRATEGIES,
} from "@/lib/items";
import { SLOT_MIN } from "@/lib/placements";
import type { Interval } from "@/lib/time/interval";
import { hoursOf } from "@/server/scheduler/preferences";
import { intervalArb, SPAN_MIN } from "./intervals";

/** `item` as it's saved, without the id and occurrence states the database adds. */
export function unsaved<T extends Item>({ id, occurrences, ...item }: T): Omit<T, "id" | "occurrences"> & NewItem {
  return item as Omit<T, "id" | "occurrences"> & NewItem;
}

export function fixed(
  title: string,
  { start, end }: Interval,
  bufferBeforeMin = 0,
  bufferAfterMin = bufferBeforeMin,
): FixedItem {
  return {
    id: title,
    title,
    priority: "mandatory",
    timing: "fixed",
    recurrence: null,
    occurrences: {},
    changes: {},
    categoryId: null,
    start,
    end,
    location: null,
    bufferBeforeMin,
    bufferAfterMin,
  };
}

export function flexible(title: string, durationMin: number, window: Interval, priority: Priority = "normal"): Task {
  return {
    id: title,
    title,
    priority,
    timing: "flexible",
    recurrence: null,
    occurrences: {},
    changes: {},
    categoryId: null,
    durationMin,
    earliestStart: window.start,
    deadline: window.end,
    split: null,
    spread: "asap",
    withinPeriod: false,
    upTo: false,
    totalMin: null,
    timeOfDay: null,
    done: false,
  };
}

export const fixedItemArb = fc
  .tuple(intervalArb(), fc.integer({ min: 0, max: 90 }), fc.integer({ min: 0, max: 90 }))
  .map(([interval, before, after]) => fixed("Fixed", interval, before, after));

/** Whole slots, as task durations and chunk sizes are. */
export const taskMinutesArb = (min: number, max: number) =>
  fc.integer({ min: Math.ceil(min / SLOT_MIN), max: max / SLOT_MIN }).map((slots) => slots * SLOT_MIN);

export const splitArb = fc
  .tuple(taskMinutesArb(SLOT_MIN, 120), taskMinutesArb(0, 120))
  .map(([minChunkMin, extra]) => ({ minChunkMin, maxChunkMin: minChunkMin + extra }));

/** Hours on the slot grid, a hard limit or a preference. */
export const timeOfDayArb = fc
  .tuple(taskMinutesArb(0, 23 * 60), taskMinutesArb(SLOT_MIN, 8 * 60), fc.boolean())
  .map(([startMinute, lengthMin, must]) => ({
    startMinute,
    endMinute: Math.min(startMinute + lengthMin, 24 * 60),
    must,
  }));

/** Tasks with unique ids. */
export const flexibleItemsArb = fc
  .array(
    fc.tuple(
      taskMinutesArb(SLOT_MIN, 4 * 60),
      intervalArb(SPAN_MIN),
      fc.constantFrom(...PRIORITIES),
      fc.option(splitArb, { nil: null }),
      fc.constantFrom(...SPREAD_STRATEGIES),
      fc.option(timeOfDayArb, { nil: null, freq: 3 }),
    ),
    { maxLength: 10 },
  )
  .map((tasks) =>
    tasks.map(([durationMin, window, priority, split, spread, timeOfDay], i) => ({
      ...flexible(`Task ${i}`, durationMin, window, priority),
      split,
      spread,
      timeOfDay,
    })),
  );

/** Whether `block` lies in `task`'s time of day when it must, read in UTC. */
export function inRequiredHours(task: Task, block: Interval): boolean {
  if (!task.timeOfDay?.must) return true;
  const { startMinute, endMinute } = task.timeOfDay;
  const start = block.start.getUTCHours() * 60 + block.start.getUTCMinutes();
  return (
    (startMinute === 0 && endMinute === 24 * 60) ||
    (start >= startMinute && start + (block.end.getTime() - block.start.getTime()) / 60_000 <= endMinute)
  );
}

/** Where `task` may go: its window, cut to its time of day when it must keep to it, read in UTC. */
export function requiredTime(task: Task): Interval[] {
  const window = { start: task.earliestStart, end: task.deadline };
  return task.timeOfDay?.must ? [...hoursOf(task, "UTC")] : [window];
}
