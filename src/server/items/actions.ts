"use server";

import "server-only";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { inPlanTransaction } from "@/server/db/plan-lock";
import { loadSettings } from "@/server/db/settings-repository";
import { PLACEMENT_STATUSES, type PlacementRef, type PlacementStatus } from "@/lib/placements";
import { parseOccurrenceId } from "@/lib/recurrence";
import {
  createItem,
  editItem,
  removeItem,
  setPlacementPinned,
  setPlacementStatus,
  setTaskDone,
  skipOccurrence,
} from "./item-commands";
import { type ItemFormErrors, type ParsedItemForm, parseItemForm } from "./parse-item-form";

export type ItemFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "invalid"; errors: ItemFormErrors; fields: Record<string, string> };

const itemId = z.uuid();
const placementRef = z.object({
  taskId: z.string().refine((id) => {
    const { itemId: item, date } = parseOccurrenceId(id);
    return itemId.safeParse(item).success && (date === null || z.iso.date().safeParse(date).success);
  }),
  start: z.date(),
});

async function loadTimeZone() {
  const settings = await loadSettings(db);
  if (!settings) throw new Error("Settings must be saved before editing items");
  return settings.timeZone;
}

async function parseSubmission(formData: FormData, now: Date) {
  const timeZone = await loadTimeZone();
  const fields = Object.fromEntries([...formData].map(([key, value]) => [key, String(value)]));
  return { fields, timeZone, parsed: parseItemForm(fields, timeZone, now) };
}

function invalid(fields: Record<string, string>, parsed: Extract<ParsedItemForm, { ok: false }>): ItemFormState {
  return { status: "invalid", errors: parsed.errors, fields };
}

export async function createItemAction(_previous: ItemFormState, formData: FormData): Promise<ItemFormState> {
  const { fields, parsed } = await parseSubmission(formData, new Date());
  if (!parsed.ok) return invalid(fields, parsed);

  await inPlanTransaction(db, (tx) => createItem(tx, parsed.item));
  refresh();
  return { status: "saved" };
}

export async function updateItemAction(
  id: string,
  _previous: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const validId = itemId.parse(id);
  const now = new Date();
  const { fields, timeZone, parsed } = await parseSubmission(formData, now);
  if (!parsed.ok) return invalid(fields, parsed);

  const found = await inPlanTransaction(db, (tx) => editItem(tx, validId, parsed.item, now, timeZone));
  if (!found) throw new Error(`Item ${validId} not found`);
  refresh();
  return { status: "saved" };
}

export async function deleteItemAction(id: string): Promise<void> {
  const validId = itemId.parse(id);
  const timeZone = await loadTimeZone();
  const found = await inPlanTransaction(db, (tx) => removeItem(tx, validId, new Date(), timeZone));
  if (!found) throw new Error(`Item ${validId} not found`);
  refresh();
}

export async function skipOccurrenceAction(id: string, date: string): Promise<void> {
  const validId = itemId.parse(id);
  const validDate = z.iso.date().parse(date);
  const found = await inPlanTransaction(db, (tx) => skipOccurrence(tx, validId, validDate));
  if (!found) throw new Error(`Series ${validId} not found`);
  refresh();
}

export async function setPlacementStatusAction(ref: PlacementRef, status: PlacementStatus): Promise<void> {
  const validRef = placementRef.parse(ref);
  const validStatus = z.enum(PLACEMENT_STATUSES).parse(status);
  const found = await inPlanTransaction(db, (tx) => setPlacementStatus(tx, validRef, validStatus, new Date()));
  if (!found) throw new Error(`Placement of ${validRef.taskId} at ${validRef.start.toISOString()} not found`);
  refresh();
}

export async function setPlacementPinnedAction(ref: PlacementRef, pinned: boolean): Promise<void> {
  const validRef = placementRef.parse(ref);
  const found = await inPlanTransaction(db, (tx) =>
    setPlacementPinned(tx, validRef, z.boolean().parse(pinned), new Date()),
  );
  if (!found) throw new Error(`Placement of ${validRef.taskId} at ${validRef.start.toISOString()} not found`);
  refresh();
}

/** Marks the one-off task `id`, or with `date` its occurrence on that local date, done or not done. */
export async function setTaskDoneAction(id: string, date: string | null, done: boolean): Promise<void> {
  const validId = itemId.parse(id);
  const validDate = z.iso.date().nullable().parse(date);
  const found = await inPlanTransaction(db, (tx) =>
    setTaskDone(tx, validId, validDate, z.boolean().parse(done), new Date()),
  );
  if (!found) throw new Error(`Task ${validId} not found`);
  refresh();
}
