import { FormSection } from "@/components/forms/form-fields";
import { SkipOccurrenceButton } from "@/components/items/skip-occurrence-button";
import { TaskDoneButton } from "@/components/items/task-done-button";
import { type Item, isTask } from "@/lib/items";
import { formatDateTime, formatLocalDate, formatTimeRange } from "@/lib/time/format";
import type { TimeZone } from "@/lib/time/time-zone";
import type { OccurrenceEntry } from "@/server/tasks";
import { BlockList } from "./task-blocks";

/** A series' upcoming occurrences: a task's with their blocks, each to mark done or skip. */
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
          {occurrences.map(({ date, start, end, blocks }) => (
            <li key={date} aria-label={formatLocalDate(date)} className="flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-sm">
                <span className="font-medium">{formatLocalDate(date)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {" "}
                  · {isTask(item) ? `due ${formatDateTime(end, timeZone)}` : formatTimeRange(start, end, timeZone)}
                </span>
              </p>
              {isTask(item) && <BlockList blocks={blocks} timeZone={timeZone} />}
              <div className="flex flex-wrap gap-2">
                {isTask(item) && <TaskDoneButton task={item} date={date} />}
                <SkipOccurrenceButton itemId={item.id} date={date} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  );
}
