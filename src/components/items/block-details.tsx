import type { EditTarget } from "@/lib/calendar-blocks";
import type { Category } from "@/lib/categories";
import { isTask } from "@/lib/items";
import { describeRecurrence } from "@/lib/recurrence";
import { formatDateTime, formatDuration } from "@/lib/time/format";
import type { TimeZone } from "@/lib/time/time-zone";
import { CategoryDot } from "@/components/categories/category-dot";
import { useClockFormat } from "@/components/time/clock-format";
import { PRIORITY_LABELS } from "./priority";

/** What matters most about a block's item, or its occurrence, at a glance. */
export function BlockDetails({
  target,
  categories,
  timeZone,
}: {
  target: EditTarget;
  categories: Category[];
  timeZone: TimeZone;
}) {
  const clock = useClockFormat();
  const item = target.occurrence?.own ?? target.item;
  const category = categories.find((candidate) => candidate.id === item.categoryId);
  const rows: [string, React.ReactNode][] = isTask(item)
    ? [
        [item.upTo ? "Up to" : "Duration", formatDuration(item.durationMin)],
        ["Due", formatDateTime(item.deadline, timeZone, clock)],
        ["Priority", PRIORITY_LABELS[item.priority]],
        ...(item.totalMin === null ? [] : [["Stop after", formatDuration(item.totalMin)] as [string, string]]),
      ]
    : item.location
      ? [["Location", item.location]]
      : [];
  if (category) {
    rows.push([
      "Category",
      <span key="category" className="inline-flex items-center gap-1.5">
        <CategoryDot color={category.color} />
        {category.name}
      </span>,
    ]);
  }
  if (item.recurrence) rows.push(["Repeats", describeRecurrence(item.recurrence)]);
  if (target.occurrence?.changed) rows.push(["This one", "Changed from the series"]);

  return (
    rows.length > 0 && (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    )
  );
}
