import "server-only";
import { z } from "zod";
import { itemFormSchema } from "@/lib/item-form";
import type { NewItem } from "@/lib/items";
import type { TimeZone } from "@/lib/time-zone";
import { toDate } from "@/server/temporal";

export type ItemFormErrors = Partial<Record<string, string[]>>;

export type ParsedItemForm = { ok: true; item: NewItem } | { ok: false; errors: ItemFormErrors };

/**
 * Validates submitted form fields and converts their local times to exact times in `timeZone`.
 * A flexible task without an earliest start starts at `now`, and its deadline must be after `now`.
 */
export function parseItemForm(
  fields: Record<string, unknown>,
  timeZone: TimeZone,
  now: Temporal.Instant,
): ParsedItemForm {
  const parsed = itemFormSchema.safeParse(fields);
  if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors };

  const form = parsed.data;
  const at = (local: string) => toDate(Temporal.PlainDateTime.from(local).toZonedDateTime(timeZone));

  if (form.timing === "fixed") {
    return {
      ok: true,
      item: {
        title: form.title,
        priority: form.priority,
        timing: "fixed",
        recurrence: null,
        start: at(form.start),
        end: at(form.end),
        location: form.location ?? null,
        bufferBeforeMin: form.bufferBeforeMin,
        bufferAfterMin: form.bufferAfterMin,
      },
    };
  }

  const earliestStart = form.earliestStart ? at(form.earliestStart) : toDate(now);
  const deadline = at(form.deadline);
  if (deadline <= toDate(now)) {
    return { ok: false, errors: { deadline: ["Deadline must be in the future"] } };
  }
  if (deadline <= earliestStart) {
    return { ok: false, errors: { deadline: ["Deadline must be after the earliest start"] } };
  }

  return {
    ok: true,
    item: {
      title: form.title,
      priority: form.priority,
      timing: "flexible",
      recurrence: null,
      durationMin: form.durationMin,
      earliestStart,
      deadline,
      split:
        form.minChunkMin !== undefined && form.maxChunkMin !== undefined
          ? { minChunkMin: form.minChunkMin, maxChunkMin: form.maxChunkMin }
          : null,
      preferredWindows: [],
      spread: form.spread,
    },
  };
}
