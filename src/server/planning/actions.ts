"use server";

import { replanWorkspace } from "@/server/planning/saved-plan";
import { changeWorkspace } from "@/server/workspaces/current-workspace";

/** Places every pending block again (see `PlanOptions.fresh`). */
export async function replanFreshAction(): Promise<void> {
  await changeWorkspace((tx, now) => replanWorkspace(tx, now, { fresh: true }), { replan: false });
}
