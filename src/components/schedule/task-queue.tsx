"use client";

import { CircleCheck } from "lucide-react";
import { useItemPanel } from "@/components/items/item-panel-state";
import { formatDateTime, formatDuration, formatLocalDate } from "@/lib/time/format";
import type { TimeZone } from "@/lib/time/time-zone";
import type { QueueEntry } from "@/server/calendar";

/** The tasks that don't fit before their deadline; an occurrence of a recurring task shows its date. */
export function TaskQueue({ entries, timeZone }: { entries: QueueEntry[]; timeZone: TimeZone }) {
  const { openEdit } = useItemPanel();

  return entries.length === 0 ? (
    <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
      <CircleCheck className="size-4" />
      Everything fits.
    </p>
  ) : (
    <ul className="flex flex-col gap-2">
      {entries.map(({ key, title, remainingMin, deadline, target }) => (
        <li key={key}>
          <button
            type="button"
            className="flex w-full flex-col gap-0.5 rounded-lg border border-l-4 border-l-amber-500 bg-card px-3 py-2 text-left text-sm shadow-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => openEdit(target)}
          >
            <span>
              <span className="font-medium">{title}</span>
              {target.occurrenceDate && (
                <span className="whitespace-nowrap text-muted-foreground">
                  {" "}
                  · {formatLocalDate(target.occurrenceDate)}
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatDuration(remainingMin)} left · due {formatDateTime(deadline, timeZone)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
