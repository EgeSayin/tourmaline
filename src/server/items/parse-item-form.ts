import "server-only";
import { z } from "zod";
import { itemFormSchema } from "@/lib/item-form";
import type { NewItem } from "@/lib/items";
import type { TimeZone } from "@/lib/time-zone";

export type ItemFormErrors = Partial<Record<string, string[]>>;

export type ParsedItemForm = { ok: true; item: NewItem } | { ok: false; errors: ItemFormErrors };

/** Validates submitted form fields and converts their local times to exact times in `timeZone`. */
export function parseItemForm(fields: Record<string, unknown>, timeZone: TimeZone): ParsedItemForm {
  const parsed = itemFormSchema.safeParse(fields);
  if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors };

  const form = parsed.data;
  const at = (local: string) =>
    new Date(Temporal.PlainDateTime.from(local).toZonedDateTime(timeZone).epochMilliseconds);

  if (form.timing === "fixed") {
    return {
      ok: true,
      item: {
        title: form.title,
        priority: form.priority,
        timing: "fixed",
        start: at(form.start),
        end: at(form.end),
        location: form.location ?? null,
        bufferBeforeMin: form.bufferBeforeMin,
        bufferAfterMin: form.bufferAfterMin,
      },
    };
  }

  return {
    ok: true,
    item: {
      title: form.title,
      priority: form.priority,
      timing: "flexible",
      durationMin: form.durationMin,
      earliestStart: at(form.earliestStart),
      deadline: at(form.deadline),
      split:
        form.minChunkMin !== undefined && form.maxChunkMin !== undefined
          ? { minChunkMin: form.minChunkMin, maxChunkMin: form.maxChunkMin }
          : null,
      preferredWindows: [],
      spread: form.spread,
    },
  };
}
