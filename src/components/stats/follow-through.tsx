import { formatDuration, formatLocalDateRange } from "@/lib/time/format";
import { cn } from "@/lib/utils";
import type { WeekOutcome } from "@/server/stats";

/**
 * Done, still to review, then missed: amber keeps green and red apart for red–green colour blindness, and missed is
 * striped as well, like a missed block's dashed outline.
 */
const PARTS = [
  { key: "doneMin", label: "Done", className: "bg-state-done" },
  { key: "unreviewedMin", label: "To review", className: "bg-state-review" },
  {
    key: "missedMin",
    label: "Missed",
    className: "bg-state-missed bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgb(255_255_255/0.45)_3px_5px)]",
  },
] as const satisfies { key: keyof WeekOutcome; label: string; className: string }[];

const total = (week: WeekOutcome) => week.doneMin + week.unreviewedMin + week.missedMin;

/** Each week's ended task blocks as one bar, scaled to the busiest week, with its hours in words beside it. */
export function FollowThrough({ weeks }: { weeks: WeekOutcome[] }) {
  const most = Math.max(...weeks.map(total), 1);
  return (
    <div className="flex flex-col gap-3">
      <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {PARTS.map(({ label, className }) => (
          <li key={label} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-3 rounded-[3px]", className)} />
            {label}
          </li>
        ))}
      </ul>
      <ol className="flex flex-col gap-2.5">
        {weeks.map((week, index) => {
          const name = index === weeks.length - 1 ? "This week" : formatLocalDateRange(week.firstDate, week.lastDate);
          const parts = PARTS.filter(({ key }) => week[key] > 0);
          return (
            <li key={week.firstDate} className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
              <span className="text-sm">{name}</span>
              <div className="flex flex-col gap-1">
                <div
                  aria-hidden
                  className="flex h-3 gap-0.5 sm:mt-1"
                  style={{ width: `${(total(week) / most) * 100}%` }}
                >
                  {parts.map(({ key, label, className }) => (
                    <span
                      key={key}
                      title={`${label}: ${formatDuration(week[key])}`}
                      className={cn("h-full first:rounded-l-sm last:rounded-r-sm", className)}
                      style={{ flexGrow: week[key] }}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {parts.length === 0
                    ? "No task blocks"
                    : parts.map(({ key, label }) => `${formatDuration(week[key])} ${label.toLowerCase()}`).join(" · ")}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
