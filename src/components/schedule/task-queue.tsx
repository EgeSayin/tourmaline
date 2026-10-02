"use client";

import { CircleCheck } from "lucide-react";
import { useItemPanel } from "@/components/items/item-panel";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { TimeZone } from "@/lib/time-zone";
import type { QueueEntry } from "@/server/calendar";

/** The tasks that don't fit before their deadline. */
export function TaskQueue({ entries, timeZone }: { entries: QueueEntry[]; timeZone: TimeZone }) {
  const { openEdit } = useItemPanel();

  return entries.length === 0 ? (
    <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
      <CircleCheck className="size-4" />
      Everything fits.
    </p>
  ) : (
    <ul className="flex flex-col gap-2">
      {entries.map(({ task, remainingMin }) => (
        <li key={task.id}>
          <button
            type="button"
            className="flex w-full flex-col gap-0.5 rounded-lg border border-l-4 border-l-amber-500 bg-card px-3 py-2 text-left text-sm shadow-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => openEdit(task)}
          >
            <span className="font-medium">{task.title}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatDuration(remainingMin)} left · due {formatDateTime(task.deadline, timeZone)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
