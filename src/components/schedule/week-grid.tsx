"use client";

import { useState } from "react";
import { useItemPanel } from "@/components/items/item-panel";
import { toCalendarBlocks } from "@/lib/calendar-blocks";
import { formatLocalWeekday } from "@/lib/format";
import type { FixedItem, FlexibleItem } from "@/lib/items";
import { localDatesInRange } from "@/lib/local-time";
import type { Placement } from "@/lib/placements";
import type { TimeZone } from "@/lib/time-zone";
import { DayColumn } from "./day-column";
import { DayNavigator } from "./day-navigator";
import { HourAxis } from "./hour-axis";
import { timeScaleFor } from "./time-scale";

export function WeekGrid({
  today,
  range,
  fixedItems,
  flexibleItems,
  placements,
  timeZone,
}: {
  /** Local date the phone view opens on when it's in the shown week. */
  today: string;
  range: { start: Date; end: Date };
  fixedItems: FixedItem[];
  flexibleItems: FlexibleItem[];
  placements: Placement[];
  timeZone: TimeZone;
}) {
  const dates = localDatesInRange(range, timeZone);
  const [selected, setSelected] = useState(Math.max(dates.indexOf(today), 0));
  const { openEdit } = useItemPanel();
  const itemsById = new Map([...fixedItems, ...flexibleItems].map((item) => [item.id, item]));
  const blocks = toCalendarBlocks(fixedItems, flexibleItems, placements, timeZone);
  const scale = timeScaleFor(blocks);

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <DayNavigator dates={dates} selected={selected} onSelect={setSelected} />

      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] md:grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
        <div className="sticky top-0 z-10 hidden border-b bg-card md:block" />
        {dates.map((date) => (
          <div key={date} className="sticky top-0 z-10 hidden border-b border-l bg-card py-3 text-center md:block">
            <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {formatLocalWeekday(date)}
            </div>
            <div className="text-xl font-semibold tabular-nums">{Number(date.slice(8))}</div>
          </div>
        ))}

        <HourAxis scale={scale} />
        {dates.map((date, i) => (
          <DayColumn
            key={date}
            blocks={blocks.filter((block) => block.date === date)}
            scale={scale}
            timeZone={timeZone}
            onSelect={(block) => {
              const item = itemsById.get(block.itemId);
              if (item) openEdit(item);
            }}
            className={i === selected ? "" : "hidden md:block"}
          />
        ))}
      </div>
    </div>
  );
}
