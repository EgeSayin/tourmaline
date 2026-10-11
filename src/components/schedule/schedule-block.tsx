"use client";

import { Pin } from "lucide-react";
import { useCategoryFilter } from "@/components/categories/category-filter";
import { PLACEMENT_STATE_LABELS } from "@/components/items/placement-state";
import type { CalendarBlock } from "@/lib/calendar-blocks";
import { matchesFilter } from "@/lib/categories";
import { formatTimeRange } from "@/lib/time/format";
import type { TimeZone } from "@/lib/time/time-zone";
import { BLOCK_STYLES, blockFill } from "./block-styles";
import type { TimeScale } from "./time-scale";

export function ScheduleBlock({
  block,
  scale,
  timeZone,
  onSelect,
}: {
  block: CalendarBlock;
  scale: TimeScale;
  timeZone: TimeZone;
  onSelect: () => void;
}) {
  const [filter] = useCategoryFilter();
  const filteredOut = !matchesFilter(block.target.item.categoryId, filter);
  const top = scale.top(block.startMinute);
  const isTiny = block.endMinute - block.startMinute < 15;
  const { placement } = block;
  const notes = [
    placement && placement.state !== "planned" && PLACEMENT_STATE_LABELS[placement.state].toLowerCase(),
    placement?.pinned && "pinned",
  ].filter(Boolean);
  const label = `${block.title} ${formatTimeRange(block.start, block.end, timeZone)}${notes.length > 0 ? ` (${notes.join(", ")})` : ""}`;

  return (
    // Overlapping blocks share the column side by side, one lane each.
    <div
      className="absolute px-0.5 md:px-1"
      style={{
        top: top + 1,
        height: scale.top(block.endMinute) - top - 2,
        left: `${(block.lane / block.lanes) * 100}%`,
        width: `${100 / block.lanes}%`,
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={label}
        data-filtered-out={filteredOut || undefined}
        title={label}
        className={`flex size-full cursor-pointer flex-col justify-start overflow-hidden rounded-md px-1 text-left text-xs md:px-2 ${
          isTiny ? "leading-3" : "py-1"
        } transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:brightness-125 ${blockFill(block.color)} ${BLOCK_STYLES[block.style].className} ${
          filteredOut ? "opacity-25" : ""
        }`}
      >
        <div className="flex items-start gap-1">
          <span className="truncate font-medium">{block.title}</span>
          {placement?.pinned && <Pin className="ml-auto size-3 shrink-0" aria-hidden />}
        </div>
      </button>
    </div>
  );
}
