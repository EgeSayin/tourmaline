import { loadCalendar } from "@/server/calendar";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { plannedToday, replanWorkspace } from "@/server/planning/saved-plan";

/** `loadCalendar` as a page reads it: planned again first on a day's first read (see `readWorkspace`). */
export async function readCalendar(tx: WorkspaceTx, now: Date, shownDate?: Temporal.PlainDate) {
  if (!(await plannedToday(tx, now))) await replanWorkspace(tx, now);
  return loadCalendar(tx, now, shownDate);
}
