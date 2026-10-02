import type { FixedItem, FlexibleItem, Priority } from "@/lib/items";
import type { Interval } from "@/server/scheduler/intervals";

export function fixed(
  title: string,
  { start, end }: Interval,
  bufferBeforeMin = 0,
  bufferAfterMin = bufferBeforeMin,
): FixedItem {
  return { id: title, title, priority: "mandatory", timing: "fixed", start, end, location: null, bufferBeforeMin, bufferAfterMin };
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
    durationMin,
    earliestStart: window.start,
    deadline: window.end,
    split: null,
    preferredWindows: [],
    spread: "asap",
  };
}
