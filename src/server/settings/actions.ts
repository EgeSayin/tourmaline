"use server";

import { refresh } from "next/cache";
import { db } from "@/server/db/client";
import { replacePendingPlacements } from "@/server/db/placements-repository";
import { inPlanTransaction } from "@/server/db/plan-lock";
import { saveFocusCaps } from "@/server/db/settings-repository";
import { type FocusCapsErrors, parseFocusCaps } from "./parse-focus-caps";

export type FocusCapsFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "invalid"; errors: FocusCapsErrors; fields: Record<string, string> };

/** Saves each weekday's focus cap and plans every block that can move again under the new caps. */
export async function saveFocusCapsAction(
  _previous: FocusCapsFormState,
  formData: FormData,
): Promise<FocusCapsFormState> {
  const fields = Object.fromEntries([...formData].map(([key, value]) => [key, String(value)]));
  const parsed = parseFocusCaps(fields);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };

  await inPlanTransaction(db, async (tx) => {
    if (!(await saveFocusCaps(tx, parsed.focusCaps))) throw new Error("Settings must be saved before focus caps");
    // Kept blocks stay where they are while they fit, so only dropping them spreads the plan under the new caps.
    await replacePendingPlacements(tx, new Date(), []);
  });
  refresh();
  return { status: "saved" };
}
