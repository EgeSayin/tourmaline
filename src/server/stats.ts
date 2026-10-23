import type { Category } from "@/lib/categories";
import { parseOccurrenceId } from "@/lib/recurrence";
import { STATS_WEEKS } from "@/lib/settings";
import { minutesBetween } from "@/lib/time/duration";
import { loadCategories } from "@/server/db/categories-repository";
import { loadItems } from "@/server/db/items-repository";
import { loadPlacements } from "@/server/db/placements-repository";
import { loadSettings } from "@/server/db/settings-repository";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { weekOf } from "@/server/time/days";
import { localDate } from "@/server/time/temporal";

/** What became of one week's task blocks that have ended, in minutes; `unreviewed` ones are still to review. */
export interface WeekOutcome {
  firstDate: string;
  lastDate: string;
  doneMin: number;
  missedMin: number;
  unreviewedMin: number;
}

export interface CategoryTime {
  /** `null` for tasks without a category. */
  category: Category | null;
  doneMin: number;
}

export interface Stats {
  /** The last `STATS_WEEKS` weeks, oldest first, this one last. */
  weeks: WeekOutcome[];
  /** Time in done blocks over those weeks, by the task's category, most first; none without any. */
  categories: CategoryTime[];
}

/** Counts each task block that ended by `now` in the week it started in, by local time. */
export async function loadStats(tx: WorkspaceTx, now: Date): Promise<Stats> {
  const [{ timeZone }, items, categories] = await Promise.all([loadSettings(tx), loadItems(tx), loadCategories(tx)]);
  const today = localDate(now, timeZone);
  const weeks = Array.from({ length: STATS_WEEKS }, (_, i) =>
    weekOf(today.subtract({ weeks: STATS_WEEKS - 1 - i }), timeZone),
  );
  const outcomes: WeekOutcome[] = weeks.map(({ dates }) => ({
    firstDate: dates[0],
    lastDate: dates.at(-1)!,
    doneMin: 0,
    missedMin: 0,
    unreviewedMin: 0,
  }));

  const categoryOf = new Map(items.map((item) => [item.id, item.categoryId]));
  const doneByCategory = new Map<string | null, number>();
  const start = weeks[0].range.start;
  for (const placement of await loadPlacements(tx, { start, end: now })) {
    if (placement.start < start || placement.end > now) continue;
    const week = outcomes[weeks.findIndex(({ range }) => placement.start < range.end)];
    const minutes = minutesBetween(placement.start, placement.end);
    if (placement.status === "done") {
      week.doneMin += minutes;
      const categoryId = categoryOf.get(parseOccurrenceId(placement.taskId).itemId) ?? null;
      doneByCategory.set(categoryId, (doneByCategory.get(categoryId) ?? 0) + minutes);
    } else if (placement.status === "missed") week.missedMin += minutes;
    else week.unreviewedMin += minutes;
  }

  return {
    weeks: outcomes,
    categories: [...doneByCategory]
      .map(([id, doneMin]) => ({ category: categories.find((category) => category.id === id) ?? null, doneMin }))
      .sort((a, b) => b.doneMin - a.doneMin),
  };
}
