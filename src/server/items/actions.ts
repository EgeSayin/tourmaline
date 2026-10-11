"use server";

import { changeWorkspace, withWorkspace } from "@/server/workspaces/current-workspace";
import { refresh } from "next/cache";
import { type FormState, formFields } from "@/lib/form-state";
import { z } from "zod";
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
import { parseItemForm } from "./parse-item-form";

const itemId = z.uuid();
const placementRef = z.object({
  taskId: z.string().refine((id) => {
    const { itemId: item, date } = parseOccurrenceId(id);
    return itemId.safeParse(item).success && (date === null || z.iso.date().safeParse(date).success);
  }),
  start: z.date(),
});

async function loadTimeZone() {
  return (await withWorkspace(loadSettings)).timeZone;
}

async function parseSubmission(formData: FormData, now: Date) {
  const timeZone = await loadTimeZone();
  const fields = formFields(formData);
  return { fields, timeZone, parsed: parseItemForm(fields, timeZone, now) };
}

export async function createItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { fields, parsed } = await parseSubmission(formData, new Date());
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };

  await changeWorkspace((tx) => createItem(tx, parsed.item));
  refresh();
  return { status: "saved" };
}

export async function updateItemAction(id: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const validId = itemId.parse(id);
  const now = new Date();
  const { fields, timeZone, parsed } = await parseSubmission(formData, now);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };

  const found = await changeWorkspace((tx) => editItem(tx, validId, parsed.item, now, timeZone));
  if (!found) throw new Error(`Item ${validId} not found`);
  refresh();
  return { status: "saved" };
}

export async function deleteItemAction(id: string): Promise<void> {
  const validId = itemId.parse(id);
  const timeZone = await loadTimeZone();
  const found = await changeWorkspace((tx) => removeItem(tx, validId, new Date(), timeZone));
  if (!found) throw new Error(`Item ${validId} not found`);
  refresh();
}

export async function skipOccurrenceAction(id: string, date: string): Promise<void> {
  const validId = itemId.parse(id);
  const validDate = z.iso.date().parse(date);
  const found = await changeWorkspace((tx) => skipOccurrence(tx, validId, validDate));
  if (!found) throw new Error(`Series ${validId} not found`);
  refresh();
}

export async function setPlacementStatusAction(ref: PlacementRef, status: PlacementStatus): Promise<void> {
  const validRef = placementRef.parse(ref);
  const validStatus = z.enum(PLACEMENT_STATUSES).parse(status);
  const found = await changeWorkspace((tx) => setPlacementStatus(tx, validRef, validStatus, new Date()));
  if (!found) throw new Error(`Placement of ${validRef.taskId} at ${validRef.start.toISOString()} not found`);
  refresh();
}

export async function setPlacementPinnedAction(ref: PlacementRef, pinned: boolean): Promise<void> {
  const validRef = placementRef.parse(ref);
  const found = await changeWorkspace((tx) => setPlacementPinned(tx, validRef, z.boolean().parse(pinned), new Date()));
  if (!found) throw new Error(`Placement of ${validRef.taskId} at ${validRef.start.toISOString()} not found`);
  refresh();
}

export async function setTaskDoneAction(id: string, date: string | null, done: boolean): Promise<void> {
  const validId = itemId.parse(id);
  const validDate = z.iso.date().nullable().parse(date);
  const found = await changeWorkspace((tx) => setTaskDone(tx, validId, validDate, z.boolean().parse(done), new Date()));
  if (!found) throw new Error(`Task ${validId} not found`);
  refresh();
}
