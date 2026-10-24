import type { EditTarget } from "@/lib/calendar-blocks";
import type { Category } from "@/lib/categories";
import { type Item, isTask } from "@/lib/items";
import { type ByWeekday, describeRecurrence } from "@/lib/recurrence";
import { type ClockFormat, formatTimeOfDayRange } from "@/lib/time/clock";
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
        [
          item.upTo ? `At most per ${item.recurrence?.frequency === "daily" ? "day" : "week"}` : "Duration",
          item.upTo ? `${formatDuration(item.durationMin)}, spare time only` : formatDuration(item.durationMin),
        ],
        ["Due", formatDateTime(item.deadline, timeZone, clock)],
        ["Priority", PRIORITY_LABELS[item.priority]],
        ...(item.totalMin === null
          ? []
          : [["Stops after", `${formatDuration(item.totalMin)} in total`] as [string, string]]),
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
  if (item.recurrence) rows.push(["Repeats", describeRecurrence(item.recurrence, dayDetails(item, clock))]);
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

/** Each weekday's own times or duration, to follow its day in the series' description. */
function dayDetails(item: Item, clock: ClockFormat): ByWeekday<string> {
  const details = isTask(item)
    ? Object.entries(item.dayDurations ?? {}).map(([day, minutes]) => [day, formatDuration(minutes)])
    : Object.entries(item.dayTimes ?? {}).map(([day, time]) => [
        day,
        formatTimeOfDayRange(time.startMinute, time.endMinute, clock),
      ]);
  return Object.fromEntries(details);
}
