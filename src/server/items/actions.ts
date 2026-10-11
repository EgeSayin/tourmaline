"use server";

import "server-only";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { inPlanTransaction } from "@/server/db/plan-lock";
import { loadSettings } from "@/server/db/settings-repository";
import { PLACEMENT_STATUSES, type PlacementRef, type PlacementStatus } from "@/lib/placements";
import { CLASH_RESOLUTION_FIELD } from "@/lib/item-form";
import { parseOccurrenceId } from "@/lib/recurrence";
import type { Clash } from "./clashes";
import {
  type ClashResolution,
  removeItem,
  saveItem,
  setBumped,
  setPlacementPinned,
  setPlacementStatus,
  setTaskDone,
  skipOccurrence,
} from "./item-commands";
import { type ItemFormErrors, parseItemForm } from "./parse-item-form";

export type ItemFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "invalid"; errors: ItemFormErrors; fields: Record<string, string> }
  | { status: "clashes"; clashes: Clash[]; fields: Record<string, string> };

const clashResolution = z.enum(["ask", "keep", "bump"] satisfies ClashResolution[]).catch("ask");

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

/** Saves the submitted item as a new item, or over the stored item `id`, unless it's invalid or has clashes to resolve. */
async function submitItem(id: string | null, formData: FormData): Promise<ItemFormState> {
  const now = new Date();
  const timeZone = await loadTimeZone();
  const { [CLASH_RESOLUTION_FIELD]: resolution, ...fields } = Object.fromEntries(
    [...formData].map(([key, value]) => [key, String(value)]),
  );
  const parsed = parseItemForm(fields, timeZone, now);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };

  const saved = await inPlanTransaction(db, (tx) =>
    saveItem(tx, id, parsed.item, clashResolution.parse(resolution), now, timeZone),
  );
  if (!saved) throw new Error(`Item ${id} not found`);
  if ("clashes" in saved) return { status: "clashes", clashes: saved.clashes, fields };
  refresh();
  return { status: "saved" };
}

export async function createItemAction(_previous: ItemFormState, formData: FormData): Promise<ItemFormState> {
  return submitItem(null, formData);
}

export async function updateItemAction(
  id: string,
  _previous: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  return submitItem(itemId.parse(id), formData);
}

export async function deleteItemAction(id: string): Promise<void> {
  const validId = itemId.parse(id);
  const timeZone = await loadTimeZone();
  const found = await inPlanTransaction(db, (tx) => removeItem(tx, validId, new Date(), timeZone));
  if (!found) throw new Error(`Item ${validId} not found`);
  refresh();
}

/** Puts the bumped one-off fixed item `id`, or with `date` its occurrence on that local date, back on the calendar. */
export async function restoreBumpedAction(id: string, date: string | null): Promise<void> {
  const validId = itemId.parse(id);
  const validDate = z.iso.date().nullable().parse(date);
  const found = await inPlanTransaction(db, (tx) => setBumped(tx, validId, validDate, false));
  if (!found) throw new Error(`Fixed item ${validId} not found`);
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
