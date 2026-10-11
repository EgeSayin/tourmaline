import type { EditTarget } from "@/lib/calendar-blocks";
import type { Item } from "@/lib/items";
import { parseOccurrenceId } from "@/lib/recurrence";
import type { TimeZone } from "@/lib/time/time-zone";
import { nextOccurrence } from "@/server/recurrence";

/** Finds the edit target for an item or occurrence id among `items`. */
export function editTargets(items: Item[], now: Date, timeZone: TimeZone): (id: string) => EditTarget | undefined {
  const editable = new Map(
    items.map((item) => {
      const next = nextOccurrence(item, now, timeZone);
      return [item.id, next ? { ...next, id: item.id } : item];
    }),
  );
  return (id) => {
    const { itemId, date } = parseOccurrenceId(id);
    const item = editable.get(itemId);
    return item && { item, occurrenceDate: date };
  };
}
