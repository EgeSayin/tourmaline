import "server-only";
import { z } from "zod";
import { itemFormSchema } from "@/lib/item-form";
import type { NewItem } from "@/lib/items";
import type { Recurrence } from "@/lib/recurrence";
import type { TimeZone } from "@/lib/time/time-zone";
import { firstOccurrence, withFirstDeadline } from "@/server/recurrence";
import { toDate } from "@/server/time/temporal";

export type ItemFormErrors = Partial<Record<string, string[]>>;

export type ParsedItemForm = { ok: true; item: NewItem } | { ok: false; errors: ItemFormErrors };

/**
 * Validates submitted form fields and converts their local times to exact times in `timeZone`.
 * A one-off flexible task without an earliest start starts at `now`, and its deadline must be after `now`.
 * A recurring item must occur at least once; a recurring task is due when its first occurrence's window ends.
 */
export function parseItemForm(fields: Record<string, unknown>, timeZone: TimeZone, now: Date): ParsedItemForm {
  const parsed = itemFormSchema.safeParse(fields);
  if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors };

  const form = parsed.data;
  const at = (local: string) => toDate(Temporal.PlainDateTime.from(local).toZonedDateTime(timeZone));
  const until = form.until ?? null;
  const recurrence: Recurrence | null =
    form.repeat === "none"
      ? null
      : form.repeat === "daily"
        ? { frequency: "daily", interval: form.interval, until }
        : { frequency: "weekly", interval: form.interval, weekdays: form.weekdays, until };
  const neverOccurs: ParsedItemForm = { ok: false, errors: { until: ["The series ends before it first occurs"] } };

  if (form.timing === "fixed") {
    const item: NewItem = {
      title: form.title,
      priority: form.priority,
      timing: "fixed",
      recurrence,
      start: at(form.start),
      end: at(form.end),
      location: form.location ?? null,
      bufferBeforeMin: form.bufferBeforeMin,
      bufferAfterMin: form.bufferAfterMin,
    };
    return recurrence && !firstOccurrence(item, timeZone) ? neverOccurs : { ok: true, item };
  }

  const task = {
    title: form.title,
    priority: form.priority,
    timing: "flexible" as const,
    recurrence,
    durationMin: form.durationMin,
    split:
      form.minChunkMin !== undefined && form.maxChunkMin !== undefined
        ? { minChunkMin: form.minChunkMin, maxChunkMin: form.maxChunkMin }
        : null,
    spread: form.spread,
  };
  const earliestStart = form.earliestStart ? at(form.earliestStart) : now;

  if (recurrence) {
    const item = withFirstDeadline({ ...task, earliestStart }, timeZone);
    return item ? { ok: true, item } : neverOccurs;
  }

  const deadline = at(form.deadline!);
  if (deadline <= now) {
    return { ok: false, errors: { deadline: ["Deadline must be in the future"] } };
  }
  if (deadline <= earliestStart) {
    return { ok: false, errors: { deadline: ["Deadline must be after the earliest start"] } };
  }
  return { ok: true, item: { ...task, earliestStart, deadline } };
}
