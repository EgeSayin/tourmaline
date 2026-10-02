"use client";

import { CircleCheck } from "lucide-react";
import { useItemPanel } from "@/components/items/item-panel";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { FlexibleItem } from "@/lib/items";
import type { TimeZone } from "@/lib/time-zone";

/** The tasks that don't fit before their deadline; `tasks` hold the remaining time, `flexibleItems` the saved tasks. */
export function TaskQueue({
  tasks,
  flexibleItems,
  timeZone,
}: {
  tasks: FlexibleItem[];
  flexibleItems: FlexibleItem[];
  timeZone: TimeZone;
}) {
  const { openEdit } = useItemPanel();
  const itemsById = new Map(flexibleItems.map((item) => [item.id, item]));

  return tasks.length === 0 ? (
    <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
      <CircleCheck className="size-4" />
      Everything fits.
    </p>
  ) : (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            className="flex w-full flex-col gap-0.5 rounded-lg border border-l-4 border-l-amber-500 bg-card px-3 py-2 text-left text-sm shadow-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => {
              const item = itemsById.get(task.id);
              if (item) openEdit(item);
            }}
          >
            <span className="font-medium">{task.title}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatDuration(task.durationMin)} left · due {formatDateTime(task.deadline, timeZone)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
