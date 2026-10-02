"use server";

import "server-only";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { deleteItem, insertItem, updateItem } from "@/server/db/items-repository";
import { loadSettings } from "@/server/db/settings-repository";
import { type ItemFormErrors, type ParsedItemForm, parseItemForm } from "./parse-item-form";

export type ItemFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "invalid"; errors: ItemFormErrors; fields: Record<string, string> };

const itemId = z.uuid();

async function parseSubmission(formData: FormData) {
  const settings = await loadSettings(db);
  if (!settings) throw new Error("Settings must be saved before editing items");

  const fields = Object.fromEntries([...formData].map(([key, value]) => [key, String(value)]));
  return { fields, parsed: parseItemForm(fields, settings.timeZone, Temporal.Now.instant()) };
}

function invalid(fields: Record<string, string>, parsed: Extract<ParsedItemForm, { ok: false }>): ItemFormState {
  return { status: "invalid", errors: parsed.errors, fields };
}

export async function createItem(_previous: ItemFormState, formData: FormData): Promise<ItemFormState> {
  const { fields, parsed } = await parseSubmission(formData);
  if (!parsed.ok) return invalid(fields, parsed);

  await db.transaction((tx) => insertItem(tx, parsed.item));
  refresh();
  return { status: "saved" };
}

export async function updateItemAction(
  id: string,
  _previous: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const validId = itemId.parse(id);
  const { fields, parsed } = await parseSubmission(formData);
  if (!parsed.ok) return invalid(fields, parsed);

  const found = await db.transaction((tx) => updateItem(tx, validId, parsed.item));
  if (!found) throw new Error(`Item ${validId} not found`);
  refresh();
  return { status: "saved" };
}

export async function deleteItemAction(id: string): Promise<void> {
  const validId = itemId.parse(id);
  if (!(await deleteItem(db, validId))) throw new Error(`Item ${validId} not found`);
  refresh();
}
