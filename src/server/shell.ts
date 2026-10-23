import type { EditTarget } from "@/lib/calendar-blocks";
import type { Category } from "@/lib/categories";
import { loadCategories } from "@/server/db/categories-repository";
import type { PlacementRef } from "@/lib/placements";
import type { TimeZone } from "@/lib/time/time-zone";
import { loadItems } from "@/server/db/items-repository";
import { loadPlacementsToReview } from "@/server/db/placements-repository";
import { loadSettings } from "@/server/db/settings-repository";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { editTargets } from "@/server/edit-targets";
import { loadQueue } from "@/server/planning/saved-plan";

export interface QueueEntry {
  /** Unique among the entries. */
  key: string;
  title: string;
  remainingMin: number;
  deadline: Date;
  target: EditTarget;
}

export interface ReviewEntry {
  /** Unique among the entries. */
  key: string;
  title: string;
  start: Date;
  end: Date;
  ref: PlacementRef;
  target: EditTarget;
}

/** What every page shows around it. */
export interface Shell {
  timeZone: TimeZone;
  /** Planned tasks due after now whose remaining time doesn't fit before their deadline. */
  queue: QueueEntry[];
  /** Every past block still to review, oldest first. */
  review: ReviewEntry[];
  /** To file items under from the block panel. */
  categories: Category[];
}

/** Reads the plan (see `loadQueue`) and the blocks still to review. */
export async function loadShell(tx: WorkspaceTx, now: Date): Promise<Shell> {
  const [settings, items, categories] = await Promise.all([loadSettings(tx), loadItems(tx), loadCategories(tx)]);
  const { timeZone } = settings;
  const targetFor = editTargets(items, now, timeZone);
  const [queue, toReview] = await Promise.all([loadQueue(tx, items, settings, now), loadPlacementsToReview(tx, now)]);

  return {
    timeZone,
    categories,
    queue: queue.map(({ id, title, remainingMin, deadline }) => ({
      key: id,
      title,
      remainingMin,
      deadline,
      target: targetFor(id)!,
    })),
    review: toReview.flatMap(({ taskId, start, end }) => {
      const target = targetFor(taskId);
      return target
        ? [
            {
              key: `${taskId}@${start.toISOString()}`,
              title: target.item.title,
              start,
              end,
              ref: { taskId, start },
              target,
            },
          ]
        : [];
    }),
  };
}
