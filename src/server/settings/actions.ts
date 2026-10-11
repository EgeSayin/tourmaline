"use server";

import { refresh } from "next/cache";
import { type FormState, formFields } from "@/lib/form-state";
import { db } from "@/server/db/client";
import { replacePendingPlacements } from "@/server/db/placements-repository";
import { inPlanTransaction } from "@/server/db/plan-lock";
import { saveFocusCaps } from "@/server/db/settings-repository";
import { parseFocusCaps } from "./parse-focus-caps";

/** Saves each weekday's focus cap and plans every block that can move again under the new caps. */
export async function saveFocusCapsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const fields = formFields(formData);
  const parsed = parseFocusCaps(fields);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };

  await inPlanTransaction(db, async (tx) => {
    await saveFocusCaps(tx, parsed.focusCaps);
    // Kept blocks stay where they are while they fit, so only dropping them spreads the plan under the new caps.
    await replacePendingPlacements(tx, new Date(), []);
  });
  refresh();
  return { status: "saved" };
}
