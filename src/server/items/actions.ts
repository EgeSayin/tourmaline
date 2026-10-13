"use server";

import { changeWorkspace, changeWorkspaceForm } from "@/server/workspaces/current-workspace";
import { type FormState, formFields } from "@/lib/form-state";
import { z } from "zod";
import { loadSettings } from "@/server/db/settings-repository";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { PLACEMENT_STATUSES, type PlacementRef, type PlacementStatus } from "@/lib/placements";
import { parseOccurrenceId } from "@/lib/recurrence";
import { createItem, editItem, removeItem, setTaskDone, skipOccurrence } from "./item-commands";
import { setPlacementPinned, setPlacementStatus } from "./placement-commands";
import { parseItemForm } from "./parse-item-form";

const itemId = z.uuid();
const placementRef = z.object({
  taskId: z.string().refine((id) => {
    const { itemId: item, date } = parseOccurrenceId(id);
    return itemId.safeParse(item).success && (date === null || z.iso.date().safeParse(date).success);
  }),
  start: z.date(),
});

/** Parses an item form inside `tx`, so its time zone is the one the change is saved against. */
async function parseSubmission(tx: WorkspaceTx, formData: FormData, now: Date) {
  const fields = formFields(formData);
  const { timeZone } = await loadSettings(tx);
  return { fields, timeZone, parsed: parseItemForm(fields, timeZone, now) };
}

// An item or block another tab deleted meanwhile is left alone: the refreshed page shows it gone.

export async function createItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return changeWorkspaceForm(async (tx, now) => {
    const { fields, parsed } = await parseSubmission(tx, formData, now);
    if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };
    await createItem(tx, parsed.item);
    return { status: "saved" };
  });
}

export async function updateItemAction(id: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const validId = itemId.parse(id);
  return changeWorkspaceForm(async (tx, now) => {
    const { fields, timeZone, parsed } = await parseSubmission(tx, formData, now);
    if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };
    await editItem(tx, validId, parsed.item, now, timeZone);
    return { status: "saved" };
  });
}

export async function deleteItemAction(id: string): Promise<void> {
  const validId = itemId.parse(id);
  await changeWorkspace(async (tx, now) => {
    await removeItem(tx, validId, now, (await loadSettings(tx)).timeZone);
  });
}

export async function skipOccurrenceAction(id: string, date: string): Promise<void> {
  const validId = itemId.parse(id);
  const validDate = z.iso.date().parse(date);
  await changeWorkspace((tx, now) => skipOccurrence(tx, validId, validDate, now));
}

export async function setPlacementStatusAction(ref: PlacementRef, status: PlacementStatus): Promise<void> {
  const validRef = placementRef.parse(ref);
  const validStatus = z.enum(PLACEMENT_STATUSES).parse(status);
  await changeWorkspace((tx, now) => setPlacementStatus(tx, validRef, validStatus, now));
}

export async function setPlacementPinnedAction(ref: PlacementRef, pinned: boolean): Promise<void> {
  const validRef = placementRef.parse(ref);
  const validPinned = z.boolean().parse(pinned);
  await changeWorkspace((tx, now) => setPlacementPinned(tx, validRef, validPinned, now));
}

export async function setTaskDoneAction(id: string, date: string | null, done: boolean): Promise<void> {
  const validId = itemId.parse(id);
  const validDate = z.iso.date().nullable().parse(date);
  const validDone = z.boolean().parse(done);
  await changeWorkspace((tx, now) => setTaskDone(tx, validId, validDate, validDone, now));
}
