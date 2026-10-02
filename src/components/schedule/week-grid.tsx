"use client";

import { useItemPanel } from "@/components/items/item-panel";
import { toCalendarBlocks } from "@/lib/calendar-blocks";
import { formatLocalWeekday } from "@/lib/format";
import type { FixedItem, FlexibleItem } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import type { TimeZone } from "@/lib/time-zone";
import { DayColumn } from "./day-column";
import { HourAxis } from "./hour-axis";
import { timeScaleFor } from "./time-scale";

export function WeekGrid({
  today,
  dates,
  fixedItems,
  flexibleItems,
  placements,
  timeZone,
  className = "",
}: {
  /** Local date of now, highlighted when it's in the shown week. */
  today: string;
  dates: string[];
  fixedItems: FixedItem[];
  flexibleItems: FlexibleItem[];
  placements: Placement[];
  timeZone: TimeZone;
  className?: string;
}) {
  const { openEdit } = useItemPanel();
  const itemsById = new Map([...fixedItems, ...flexibleItems].map((item) => [item.id, item]));
  const blocks = toCalendarBlocks(fixedItems, flexibleItems, placements, timeZone);
  const scale = timeScaleFor(blocks);
  return (
    <div className={`overflow-hidden rounded-xl border bg-card shadow-sm ${className}`}>
      <div
        className="grid [--axis:2.75rem] md:[--axis:3.5rem]"
        style={{ gridTemplateColumns: `var(--axis) repeat(${dates.length}, minmax(0, 1fr))` }}
      >
        <div className="sticky top-0 z-10 border-b bg-card" />
        {dates.map((date) => (
          <div key={date} className="sticky top-0 z-10 border-b border-l bg-card py-2 text-center md:py-3">
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
            blocks={blocks.filter((block) => block.date === date)}
            scale={scale}
            timeZone={timeZone}
            onSelect={(block) => {
              const item = itemsById.get(block.itemId);
              if (item) openEdit(item);
            }}
          />
        ))}
      </div>
    </div>
  );
}
