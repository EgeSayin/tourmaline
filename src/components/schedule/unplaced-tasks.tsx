import { TriangleAlert } from "lucide-react";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { FlexibleItem } from "@/lib/items";
import type { TimeZone } from "@/lib/time-zone";

export function UnplacedTasks({ tasks, timeZone }: { tasks: FlexibleItem[]; timeZone: TimeZone }) {
  if (tasks.length === 0) return null;

  return (
    <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-destructive">
        <TriangleAlert className="size-4" />
        Couldn&apos;t fit {tasks.length === 1 ? "1 task" : `${tasks.length} tasks`}
      </h2>
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
            <span className="font-medium">{task.title}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatDuration(task.durationMin)} · due {formatDateTime(task.deadline, timeZone)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
