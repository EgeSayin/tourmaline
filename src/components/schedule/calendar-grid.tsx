"use client";

import { useItemPanel } from "@/components/items/item-panel";
import { type CalendarItems, toCalendarBlocks } from "@/lib/calendar-blocks";
import { formatLocalWeekday } from "@/lib/format";
import type { TimeZone } from "@/lib/time-zone";
import { DayColumn } from "./day-column";
import { HourAxis } from "./hour-axis";
import { timeScaleFor } from "./time-scale";

/** Shows `dayDates` on phones and `weekDates` on larger screens, rendering each date once. */
export function CalendarGrid({
  today,
  weekDates,
  dayDates,
  calendarItems,
  timeZone,
}: {
  /** Local date of now, highlighted when shown. */
  today: string;
  weekDates: string[];
  dayDates: string[];
  calendarItems: CalendarItems;
  timeZone: TimeZone;
}) {
  const { openEdit } = useItemPanel();
  const blocks = toCalendarBlocks(calendarItems, timeZone);
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
          </div>
        ))}

        <HourAxis scale={scale} />
        {dates.map((date) => (
          <DayColumn
            key={date}
            className={shownOn(date)}
            blocks={blocks.filter((block) => block.date === date)}
            scale={scale}
            timeZone={timeZone}
            onSelect={(block) => openEdit(block.item)}
          />
        ))}
      </div>
    </div>
  );
}
