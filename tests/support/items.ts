import fc from "fast-check";
import { type FixedItem, type Task, type Item, type NewItem, PRIORITIES, type Priority } from "@/lib/items";
import type { Interval } from "@/lib/time/interval";
import { intervalArb, SPAN_MIN } from "./intervals";

/** `item` as it's saved, without the id and overrides the database adds. */
export function unsaved<T extends Item>({ id, overrides, ...item }: T): Omit<T, "id" | "overrides"> & NewItem {
  return item as Omit<T, "id" | "overrides"> & NewItem;
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
    overrides: [],
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
    overrides: [],
    durationMin,
    earliestStart: window.start,
    deadline: window.end,
    split: null,
    preferredWindows: [],
    spread: "asap",
  };
}

export const fixedItemArb = fc
  .tuple(intervalArb(), fc.integer({ min: 0, max: 90 }), fc.integer({ min: 0, max: 90 }))
  .map(([interval, before, after]) => fixed("Fixed", interval, before, after));

const minuteOfDayArb = fc.integer({ min: 0, max: 24 * 60 - 1 });
const dailyWindowArb = fc.record({ startMinute: minuteOfDayArb, endMinute: minuteOfDayArb });

/** Tasks with unique ids. */
export const flexibleItemsArb = fc
  .array(
    fc.tuple(
      fc.integer({ min: 1, max: 4 * 60 }),
      intervalArb(SPAN_MIN),
      fc.constantFrom(...PRIORITIES),
      fc.array(dailyWindowArb, { maxLength: 2 }),
    ),
    { maxLength: 10 },
  )
  .map((tasks) =>
    tasks.map(([durationMin, window, priority, preferredWindows], i) => ({
      ...flexible(`Task ${i}`, durationMin, window, priority),
      preferredWindows,
    })),
  );
