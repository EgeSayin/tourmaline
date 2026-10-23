import type { EditTarget, OccurrenceEdit } from "@/lib/calendar-blocks";
import type { Item } from "@/lib/items";
import { parseOccurrenceId } from "@/lib/recurrence";
import type { TimeZone } from "@/lib/time/time-zone";
import { nextOccurrence, occurrenceOn } from "@/server/recurrence";

/**
 * Finds what to open for a task, occurrence or item id: its item as the editor shows it, a series at its next
 * occurrence without changes of its own, with the occurrence if it is one; or `undefined` if gone.
 */
export function editTargets(items: Item[], now: Date, timeZone: TimeZone): (id: string) => EditTarget | undefined {
  const stored = new Map(items.map((item) => [item.id, item]));
  const editable = new Map(
    items.map((item) => {
      const next = nextOccurrence({ ...item, changes: {} }, now, timeZone);
      return [item.id, next ? { ...next, id: item.id } : item];
    }),
  );
  return (id) => {
    const { itemId, date } = parseOccurrenceId(id);
    const item = editable.get(itemId);
    const occurrence = date ? occurrenceEdit(stored.get(itemId)!, date, timeZone) : null;
    return item && { item, occurrenceDate: date, occurrence };
  };
}

/** Series `item`'s occurrence on local date `date`, or `null` if there is none, or it's skipped. */
export function occurrenceEdit(item: Item, date: string, timeZone: TimeZone): OccurrenceEdit | null {
  const occurrence = occurrenceOn(item, date, timeZone);
  if (!occurrence) return null;
  return {
    date,
    series: { ...occurrence.series, id: item.id },
    own: { ...occurrence.own, id: item.id },
    changed: date in item.changes,
  };
}
