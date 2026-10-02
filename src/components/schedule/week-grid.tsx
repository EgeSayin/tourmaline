"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatLocalDate, formatLocalWeekday, formatTimeRange } from "@/lib/format";
import type { FixedItem, FlexibleItem, Priority } from "@/lib/items";
import { localDatesInRange, toLocal } from "@/lib/local-time";
import type { Placement } from "@/lib/placements";
import type { TimeZone } from "@/lib/time-zone";

const MINUTES_PER_DAY = 24 * 60;
const PX_PER_HOUR = 56;

interface Block {
  key: string;
  title: string;
  start: Date;
  end: Date;
  kind: "fixed" | "auto";
  priority: Priority;
  date: string;
  startMinute: number;
  endMinute: number;
}

function blockClasses({ kind, priority }: Block): string {
  if (kind === "fixed") {
    return priority === "mandatory"
      ? "border border-sky-200 bg-sky-100 text-sky-950 dark:border-sky-800 dark:bg-sky-900/60 dark:text-sky-50"
      : "border border-dashed border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-100";
  }
  return `border-l-[3px] border-violet-500 bg-violet-50 text-violet-950 dark:bg-violet-950/50 dark:text-violet-100 ${
    priority === "low" ? "opacity-60" : ""
  }`;
}

export function WeekGrid({
  range,
  fixedItems,
  flexibleItems,
  placements,
  timeZone,
}: {
  range: { start: Date; end: Date };
  fixedItems: FixedItem[];
  flexibleItems: FlexibleItem[];
  placements: Placement[];
  timeZone: TimeZone;
}) {
  const tasks = new Map(flexibleItems.map((item) => [item.id, item]));
  const blocks: Block[] = [
    ...fixedItems.map((item) => ({ ...item, key: item.id, kind: "fixed" as const })),
    ...placements.map((p) => {
      const task = tasks.get(p.itemId);
      return {
        key: p.itemId,
        title: task?.title ?? p.itemId,
        priority: task?.priority ?? "normal",
        start: p.start,
        end: p.end,
        kind: "auto" as const,
      };
    }),
  ].map((block) => {
    const start = toLocal(block.start, timeZone);
    const end = toLocal(block.end, timeZone);
    // Blocks running past midnight are cut off at the end of their first day.
    const endMinute = end.date === start.date ? end.minuteOfDay : MINUTES_PER_DAY;
    return { ...block, date: start.date, startMinute: start.minuteOfDay, endMinute };
  });

  const firstHour = Math.min(...blocks.map((b) => Math.floor(b.startMinute / 60)));
  const lastHour = Math.max(...blocks.map((b) => Math.ceil(b.endMinute / 60)));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const top = (minute: number) => ((minute - firstHour * 60) / 60) * PX_PER_HOUR;
  const dates = localDatesInRange(range, timeZone);
  const [selected, setSelected] = useState(0);
  const visibleOnPhone = (i: number) => (i === selected ? "" : "hidden md:block");

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-2 py-2 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous day"
          disabled={selected === 0}
          onClick={() => setSelected(selected - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="text-sm font-semibold">{formatLocalDate(dates[selected])}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next day"
          disabled={selected === dates.length - 1}
          onClick={() => setSelected(selected + 1)}
        >
          <ChevronRight />
        </Button>
      </div>

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

        <div className="relative" style={{ height: hours.length * PX_PER_HOUR }}>
          {hours.slice(1).map((hour) => (
            <span
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums"
              style={{ top: top(hour * 60) }}
            >
              {String(hour).padStart(2, "0")}:00
            </span>
          ))}
        </div>

        {dates.map((date, i) => (
          <div
            key={date}
            className={`relative border-l ${visibleOnPhone(i)}`}
            style={{ height: hours.length * PX_PER_HOUR }}
          >
            {hours.slice(1).map((hour) => (
              <div
                key={hour}
                className="absolute inset-x-0 border-t border-border/60"
                style={{ top: top(hour * 60) }}
              />
            ))}
            {blocks
              .filter((block) => block.date === date)
              .map((block) => (
                <div
                  key={block.key}
                  className={`absolute inset-x-1 overflow-hidden rounded-md px-2 py-1 text-xs ${blockClasses(block)}`}
                  style={{ top: top(block.startMinute) + 1, height: top(block.endMinute) - top(block.startMinute) - 2 }}
                >
                  <div className={block.endMinute - block.startMinute < 60 ? "flex gap-1.5" : ""}>
                    <div className="truncate font-medium">{block.title}</div>
                    <div className="shrink-0 tabular-nums opacity-70">
                      {formatTimeRange(block.start, block.end, timeZone)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
