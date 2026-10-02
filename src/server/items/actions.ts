"use server";

import "server-only";
import { refresh } from "next/cache";
import { db } from "@/server/db/client";
import { insertItem } from "@/server/db/items-repository";
import { loadSettings } from "@/server/db/settings-repository";
import { type ItemFormErrors, parseItemForm } from "./parse-item-form";

export type CreateItemState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "invalid"; errors: ItemFormErrors; fields: Record<string, string> };

export async function createItem(_previous: CreateItemState, formData: FormData): Promise<CreateItemState> {
  const settings = await loadSettings(db);
  if (!settings) throw new Error("Settings must be saved before adding items");

  const fields = Object.fromEntries([...formData].map(([key, value]) => [key, String(value)]));
  const parsed = parseItemForm(fields, settings.timeZone);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };

  await db.transaction((tx) => insertItem(tx, parsed.item));
  refresh();
  return { status: "saved" };
}
