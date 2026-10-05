import fc from "fast-check";
import { type FixedItem, type FlexibleItem, PRIORITIES, type Priority } from "@/lib/items";
import type { Interval } from "@/server/scheduler/intervals";
import { intervalArb, SPAN_MIN } from "./intervals";

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

export function flexible(
  title: string,
  durationMin: number,
  window: Interval,
  priority: Priority = "normal",
): FlexibleItem {
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

/** Tasks with unique ids. */
export const flexibleItemsArb = fc
  .array(fc.tuple(fc.integer({ min: 1, max: 4 * 60 }), intervalArb(SPAN_MIN), fc.constantFrom(...PRIORITIES)), {
    maxLength: 10,
  })
  .map((tasks) =>
    tasks.map(([durationMin, window, priority], i) => flexible(`Task ${i}`, durationMin, window, priority)),
  );
