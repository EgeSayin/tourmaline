import { Pencil } from "lucide-react";
import Link from "next/link";
import { FormSection } from "@/components/forms/form-fields";
import { buttonVariants } from "@/components/ui/button";
import { editHref } from "@/lib/calendar-blocks";
import { SkipOccurrenceButton } from "@/components/items/skip-occurrence-button";
import { TaskDoneButton } from "@/components/items/task-done-button";
import { type Item, isTask } from "@/lib/items";
import { formatDateTime, formatLocalDate, formatTimeRange } from "@/lib/time/format";
import type { TimeZone } from "@/lib/time/time-zone";
import type { OccurrenceEntry } from "@/server/tasks";
import { BlockList } from "./task-blocks";

export function TaskOccurrences({
  item,
  occurrences,
  timeZone,
}: {
  item: Item;
  occurrences: OccurrenceEntry[];
  timeZone: TimeZone;
}) {
  return (
    <FormSection title="Next occurrences">
      {occurrences.length === 0 ? (
        <p className="text-sm text-muted-foreground">No more occurrences.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {occurrences.map(({ date, start, end, changed, blocks }) => (
            <li key={date} aria-label={formatLocalDate(date)} className="flex flex-col gap-3 rounded-lg border p-4">
              <p className="text-sm">
                <span className="font-medium">{formatLocalDate(date)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {" "}
                  · {isTask(item) ? `due ${formatDateTime(end, timeZone)}` : formatTimeRange(start, end, timeZone)}
                  {changed && " · changed"}
                </span>
              </p>
              {isTask(item) && <BlockList blocks={blocks} timeZone={timeZone} />}
              <div className="-ml-2.5 flex flex-wrap gap-1">
                <Link
                  href={editHref({ item, occurrenceDate: date })}
                  aria-label={`Edit ${formatLocalDate(date)}`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  <Pencil />
                  Edit
                </Link>
                {isTask(item) && <TaskDoneButton task={item} date={date} compact />}
                <SkipOccurrenceButton itemId={item.id} date={date} compact />
              </div>
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  );
}
