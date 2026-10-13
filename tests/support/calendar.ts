import { loadWeek } from "@/server/calendar";
import { loadShell } from "@/server/shell";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { plannedToday, replanWorkspace } from "@/server/planning/saved-plan";
import { loadItemList } from "@/server/tasks";

/**
 * What the pages show at `now`, read as a request would (see `readWorkspace`): the shell, the week from `shownDate`
 * and the item list.
 */
export async function readCalendar(tx: WorkspaceTx, now: Date, shownDate?: Temporal.PlainDate) {
  if (!(await plannedToday(tx, now))) await replanWorkspace(tx, now);
  return {
    ...(await loadShell(tx, now)),
    ...(await loadWeek(tx, now, shownDate)),
    tasks: (await loadItemList(tx, now)).items,
  };
}

export type Calendar = Awaited<ReturnType<typeof readCalendar>>;
