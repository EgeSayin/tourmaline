"use server";

import "server-only";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { loadSettings } from "@/server/db/settings-repository";
import { createItem, editItem, removeItem, skipOccurrence } from "./item-commands";
import { type ItemFormErrors, type ParsedItemForm, parseItemForm } from "./parse-item-form";

export type ItemFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "invalid"; errors: ItemFormErrors; fields: Record<string, string> };

const itemId = z.uuid();

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

  await db.transaction((tx) => createItem(tx, parsed.item));
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

  const found = await db.transaction((tx) => editItem(tx, validId, parsed.item, now, timeZone));
  if (!found) throw new Error(`Item ${validId} not found`);
  refresh();
  return { status: "saved" };
}

export async function deleteItemAction(id: string): Promise<void> {
  const validId = itemId.parse(id);
  const timeZone = await loadTimeZone();
  const found = await db.transaction((tx) => removeItem(tx, validId, new Date(), timeZone));
  if (!found) throw new Error(`Item ${validId} not found`);
  refresh();
}

export async function skipOccurrenceAction(id: string, date: string): Promise<void> {
  const validId = itemId.parse(id);
  const validDate = z.iso.date().parse(date);
  const found = await db.transaction((tx) => skipOccurrence(tx, validId, validDate));
  if (!found) throw new Error(`Series ${validId} not found`);
  refresh();
}
