import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { RestoreButton } from "@/components/items/restore-button";
import { formatDateTime, formatDuration, formatLocalDate, formatTimeRange } from "@/lib/time/format";
import { toLocal } from "@/lib/time/local-time";
import type { TimeZone } from "@/lib/time/time-zone";
import type { QueueEntry } from "@/server/calendar";

/**
 * The tasks that don't fit before their deadline, an occurrence of a recurring task with its date, and the bumped
 * fixed items with their date, each of which can be restored.
 */
export function TaskQueue({ entries, timeZone }: { entries: QueueEntry[]; timeZone: TimeZone }) {
  return entries.length === 0 ? (
    <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
      <CircleCheck className="size-4" />
      Everything fits.
    </p>
  ) : (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => {
        const { key, title, target } = entry;
        const date = entry.kind === "bumped" ? toLocal(entry.start, timeZone).date : target.occurrenceDate;
        return (
          <li key={key} className="flex flex-col rounded-lg border border-l-4 border-l-amber-500 bg-card shadow-xs">
            <Link
              href={`/tasks?id=${target.item.id}`}
              className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span>
                <span className="font-medium">{title}</span>
                {date && <span className="whitespace-nowrap text-muted-foreground"> · {formatLocalDate(date)}</span>}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {entry.kind === "task"
                  ? `${formatDuration(entry.remainingMin)} left · due ${formatDateTime(entry.deadline, timeZone)}`
                  : `Bumped · ${formatTimeRange(entry.start, entry.end, timeZone)}`}
              </span>
            </Link>
            {entry.kind === "bumped" && (
              <div className="px-1 pb-1">
                <RestoreButton itemId={target.item.id} date={target.occurrenceDate} title={title} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
