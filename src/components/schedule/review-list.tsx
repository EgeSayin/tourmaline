"use client";

import { CircleCheck } from "lucide-react";
import { useItemPanel } from "@/components/items/item-panel-state";
import { PlacementActions } from "@/components/items/placement-actions";
import { formatLocalWeekday, formatTimeRange } from "@/lib/time/format";
import { toLocal } from "@/lib/time/local-time";
import type { TimeZone } from "@/lib/time/time-zone";
import type { ReviewEntry } from "@/server/calendar";

/** Past blocks waiting to be checked off or marked missed; until then they keep counting toward their task. */
export function ReviewList({ entries, timeZone }: { entries: ReviewEntry[]; timeZone: TimeZone }) {
  const { openEdit } = useItemPanel();

  return entries.length === 0 ? (
    <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
      <CircleCheck className="size-4" />
      Nothing to review.
    </p>
  ) : (
    <ul className="flex flex-col gap-2">
      {entries.map(({ key, title, start, end, ref, target }) => {
        const placement = { ref, state: "to-review" as const, pinned: false };
        return (
          <li
            key={key}
            className="flex flex-col gap-2 rounded-lg border border-l-4 border-l-amber-500 bg-card px-3 py-2 shadow-xs"
          >
            <button
              type="button"
              className="flex flex-col gap-0.5 text-left text-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => openEdit(target, { ...placement, start, end })}
            >
              <span className="font-medium">{title}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatLocalWeekday(toLocal(start, timeZone).date)} {formatTimeRange(start, end, timeZone)}
              </span>
            </button>
            <PlacementActions placement={placement} />
          </li>
        );
      })}
    </ul>
  );
}
