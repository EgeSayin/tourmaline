"use client";

import { TriangleAlert } from "lucide-react";
import { useItemPanel } from "@/components/items/item-panel";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { FlexibleItem } from "@/lib/items";
import type { TimeZone } from "@/lib/time-zone";

/** Tasks that don't fit before their deadline; `tasks` hold the remaining time, `flexibleItems` the saved tasks. */
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
  if (tasks.length === 0) return null;
  const itemsById = new Map(flexibleItems.map((item) => [item.id, item]));

  return (
    <section
      aria-labelledby="task-queue-heading"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
    >
      <h2 id="task-queue-heading" className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <TriangleAlert className="size-4" />
        Task queue
      </h2>
      <p className="mt-1 mb-3 text-sm text-muted-foreground">
        {tasks.length === 1
          ? "This task doesn't fit before its deadline. Edit or delete it to make room."
          : `These ${tasks.length} tasks don't fit before their deadlines. Edit or delete them to make room.`}
      </p>
      <ul className="-mx-2 flex flex-col">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              className="flex w-full flex-wrap items-baseline justify-between gap-x-4 rounded-md px-2 py-1.5 text-left text-sm hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => {
                const item = itemsById.get(task.id);
                if (item) openEdit(item);
              }}
            >
              <span className="font-medium">{task.title}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatDuration(task.durationMin)} left · due {formatDateTime(task.deadline, timeZone)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
