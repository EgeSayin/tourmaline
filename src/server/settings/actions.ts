"use server";

import { changeWorkspace } from "@/server/workspaces/current-workspace";
import { type FormState, formFields } from "@/lib/form-state";
import { isTimeZone } from "@/lib/time/time-zone";
import { replacePendingPlacements } from "@/server/db/placements-repository";
import { loadSettings, moveToTimeZone, saveWeekSettings } from "@/server/db/settings-repository";
import { parseWeekSettings } from "./parse-week-settings";

export async function saveWeekSettingsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const fields = formFields(formData);
  const parsed = parseWeekSettings(fields);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };

  await changeWorkspace(async (tx, now) => {
    const { focusCaps } = await loadSettings(tx);
    await saveWeekSettings(tx, parsed.settings);
    // Kept blocks stay where they are while they fit, so only dropping them spreads the plan under new caps.
    if (parsed.settings.focusCaps.some((cap, i) => cap !== focusCaps[i])) await replacePendingPlacements(tx, now, []);
  });
  return { status: "saved" };
}

export async function saveTimeZoneAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const fields = formFields(formData);
  const timeZone = fields.timeZone ?? "";
  if (!isTimeZone(timeZone)) return { status: "invalid", errors: { timeZone: ["Pick a time zone"] }, fields };

  await changeWorkspace(async (tx) => {
    if ((await loadSettings(tx)).timeZone !== timeZone) await moveToTimeZone(tx, timeZone);
  });
  return { status: "saved" };
}
