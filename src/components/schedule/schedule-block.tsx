"use client";

import { Pin } from "lucide-react";
import { useCategoryVisibility } from "@/components/categories/category-visibility";
import { PLACEMENT_STATE_LABELS } from "@/components/items/placement-state";
import { useClockFormat } from "@/components/time/clock-format";
import type { CalendarBlock, Laid } from "@/lib/calendar-blocks";
import { isShown } from "@/lib/categories";
import { formatTimeRange } from "@/lib/time/format";
import type { TimeZone } from "@/lib/time/time-zone";
import { BLOCK_STYLES, blockFill, BUFFER_STYLE, CONFLICT_STYLE } from "./block-styles";
import type { TimeScale } from "./time-scale";

export function ScheduleBlock({
  block,
  scale,
  timeZone,
  onSelect,
}: {
  block: Laid<CalendarBlock>;
  scale: TimeScale;
  timeZone: TimeZone;
  onSelect: () => void;
}) {
  const [visibility] = useCategoryVisibility();
  const clock = useClockFormat();
  const filteredOut = !isShown(block.target.item.categoryId, visibility);
  const fill = blockFill(block.color);
  const top = scale.top(block.startMinute);
  const isTiny = block.endMinute - block.startMinute < 15;
  const { placement } = block;
  const notes = [
    placement && placement.state !== "planned" && PLACEMENT_STATE_LABELS[placement.state].toLowerCase(),
    placement?.pinned && "pinned",
    block.style === "displaced" && "displaced",
    block.conflict && "conflict",
  ].filter(Boolean);
  const label = `${block.title} ${formatTimeRange(block.start, block.end, timeZone, clock)}${notes.length > 0 ? ` (${notes.join(", ")})` : ""}`;

  return (
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
        } transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:brightness-125 ${fill.className} ${BLOCK_STYLES[block.style].className} ${block.conflict ? CONFLICT_STYLE.className : ""} ${
          filteredOut ? "opacity-25" : ""
        }`}
        style={fill.style}
      >
        <div className="flex items-start gap-1">
          <span className="truncate font-medium">{block.title}</span>
          {placement?.pinned && <Pin className="ml-auto size-3 shrink-0" aria-hidden />}
        </div>
      </button>
    </div>
  );
}

/** A fixed item's buffer, in its block's lane; drawn under the blocks, and opening the item like its block does. */
export function BufferStrip({
  block,
  buffer,
  scale,
  onSelect,
}: {
  block: Laid<CalendarBlock>;
  buffer: CalendarBlock["buffers"][number];
  scale: TimeScale;
  onSelect: () => void;
}) {
  const [visibility] = useCategoryVisibility();
  const fill = blockFill(block.color);
  const top = scale.top(buffer.startMinute);
  return (
    <div
      className="absolute px-0.5 md:px-1"
      style={{
        top,
        height: scale.top(buffer.endMinute) - top,
        left: `${(block.lane / block.lanes) * 100}%`,
        width: `${100 / block.lanes}%`,
      }}
    >
      {/* The block itself is the accessible way to open the item. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onSelect}
        className={`block size-full cursor-pointer ${fill.className} ${
          isShown(block.target.item.categoryId, visibility) ? BUFFER_STYLE.className : "opacity-15"
        }`}
        style={{ ...fill.style, ...BUFFER_STYLE.style }}
      />
    </div>
  );
}
