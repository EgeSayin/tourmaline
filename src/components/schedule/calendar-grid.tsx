"use client";

import { useBlockPanel } from "./block-panel-state";
import type { CalendarBlock } from "@/lib/calendar-blocks";
import { formatDuration, formatLocalDate, formatLocalWeekday } from "@/lib/time/format";
import type { TimeZone } from "@/lib/time/time-zone";
import type { DayLoad } from "@/server/calendar";
import { DayColumn } from "./day-column";
import { HourAxis } from "./hour-axis";
import { timeScaleFor } from "./time-scale";

/** Shows `dayDates` on phones and `weekDates` on larger screens, rendering each date once. */
export function CalendarGrid({
  today,
  weekDates,
  dayDates,
  blocks,
  loads,
  timeZone,
}: {
  today: string;
  weekDates: string[];
  dayDates: string[];
  blocks: CalendarBlock[];
  loads: Record<string, DayLoad>;
  timeZone: TimeZone;
}) {
  const { open } = useBlockPanel();
  const scale = timeScaleFor(blocks);
  const dates = [...new Set([...weekDates, ...dayDates])].sort();
  // Hidden columns take no grid track, so each breakpoint's column count matches its visible dates.
  const shownOn = (date: string) =>
    !dayDates.includes(date) ? "hidden md:block" : !weekDates.includes(date) ? "md:hidden" : "";
  const columns = {
    "--phone-days": dayDates.length,
    "--week-days": weekDates.length,
    gridTemplateColumns: "var(--axis) repeat(var(--days), minmax(0, 1fr))",
  } as React.CSSProperties;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div
        className="grid [--axis:2.75rem] [--days:var(--phone-days)] md:[--axis:3.5rem] md:[--days:var(--week-days)]"
        style={columns}
      >
        <div className="sticky top-0 z-10 border-b bg-card" />
        {dates.map((date) => (
          <div
            key={date}
            className={`sticky top-0 z-10 border-b border-l bg-card py-2 text-center md:py-3 ${shownOn(date)}`}
          >
            <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {formatLocalWeekday(date)}
            </div>
            <div
              aria-current={date === today ? "date" : undefined}
              className="mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full text-base font-semibold tabular-nums aria-[current=date]:bg-primary aria-[current=date]:text-primary-foreground md:size-9 md:text-xl"
            >
              {Number(date.slice(8))}
            </div>
            <LoadLine load={loads[date]} />
          </div>
        ))}

        <HourAxis scale={scale} />
        {dates.map((date) => (
          <DayColumn
            key={date}
            date={date}
            label={formatLocalDate(date)}
            className={shownOn(date)}
            blocks={blocks.filter((block) => block.date === date)}
            scale={scale}
            timeZone={timeZone}
            onSelect={open}
          />
        ))}
      </div>
    </div>
  );
}

function LoadLine({ load }: { load: DayLoad | undefined }) {
  if (!load || load.capMin === null) return null;
  const over = load.usedMin > load.capMin;
  return (
    <div
      data-over={over || undefined}
      className="mt-1 text-[11px] text-muted-foreground tabular-nums data-over:font-medium data-over:text-amber-600 dark:data-over:text-amber-400"
    >
      {formatDuration(load.usedMin)} / {formatDuration(load.capMin)}
      {over && <span className="sr-only">, over the cap</span>}
    </div>
  );
}
