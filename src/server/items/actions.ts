"use server";

import { changeWorkspace, changeWorkspaceForm } from "@/server/workspaces/current-workspace";
import { type FormState, formFields } from "@/lib/form-state";
import { z } from "zod";
import { loadSettings } from "@/server/db/settings-repository";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { PLACEMENT_STATUSES, type PlacementRef, type PlacementStatus } from "@/lib/placements";
import { parseOccurrenceId } from "@/lib/recurrence";
import { changeOccurrence, createItem, editItem, removeItem, setTaskDone, skipOccurrence } from "./item-commands";
import { setPlacementPinned, setPlacementStatus } from "./placement-commands";
import { parseItemForm, parseOccurrenceForm } from "./parse-item-form";
import { loadItem } from "@/server/db/items-repository";
import { occurrenceOn } from "@/server/recurrence";

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

// An item or block another tab changed or deleted meanwhile is left alone: the action resolves to `false` and the
// refreshed page shows the latest.

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

export async function deleteItemAction(id: string): Promise<boolean> {
  const validId = itemId.parse(id);
  return changeWorkspace(async (tx, now) => removeItem(tx, validId, now, (await loadSettings(tx)).timeZone));
}

/** Gives one occurrence of a series its own timing; a series or occurrence gone meanwhile is left alone. */
export async function changeOccurrenceAction(
  id: string,
  date: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const validId = itemId.parse(id);
  const validDate = z.iso.date().parse(date);
  return changeWorkspaceForm(async (tx, now) => {
    const { timeZone } = await loadSettings(tx);
    const item = await loadItem(tx, validId);
    const occurrence = item && occurrenceOn(item, validDate, timeZone);
    if (!occurrence) return { status: "saved" };
    const fields = formFields(formData);
    const parsed = parseOccurrenceForm(fields, occurrence.series, timeZone);
    if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };
    await changeOccurrence(tx, validId, validDate, parsed.change, now, timeZone);
    return { status: "saved" };
  });
}

export async function resetOccurrenceAction(id: string, date: string): Promise<boolean> {
  const validId = itemId.parse(id);
  const validDate = z.iso.date().parse(date);
  return changeWorkspace(async (tx, now) =>
    changeOccurrence(tx, validId, validDate, null, now, (await loadSettings(tx)).timeZone),
  );
}

export async function skipOccurrenceAction(id: string, date: string): Promise<boolean> {
  const validId = itemId.parse(id);
  const validDate = z.iso.date().parse(date);
  return changeWorkspace((tx, now) => skipOccurrence(tx, validId, validDate, now));
}

export async function setPlacementStatusAction(ref: PlacementRef, status: PlacementStatus): Promise<boolean> {
  const validRef = placementRef.parse(ref);
  const validStatus = z.enum(PLACEMENT_STATUSES).parse(status);
  return changeWorkspace((tx, now) => setPlacementStatus(tx, validRef, validStatus, now));
}

export async function setPlacementPinnedAction(ref: PlacementRef, pinned: boolean): Promise<boolean> {
  const validRef = placementRef.parse(ref);
  const validPinned = z.boolean().parse(pinned);
  return changeWorkspace((tx, now) => setPlacementPinned(tx, validRef, validPinned, now));
}

export async function setTaskDoneAction(id: string, date: string | null, done: boolean): Promise<boolean> {
  const validId = itemId.parse(id);
  const validDate = z.iso.date().nullable().parse(date);
  const validDone = z.boolean().parse(done);
  return changeWorkspace((tx, now) => setTaskDone(tx, validId, validDate, validDone, now));
}
