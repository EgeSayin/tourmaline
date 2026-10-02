import type { CalendarBlock } from "@/lib/calendar-blocks";
import { formatTimeRange } from "@/lib/format";
import type { TimeZone } from "@/lib/time-zone";
import { BLOCK_STYLES } from "./block-styles";
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
  const top = scale.top(block.startMinute);
  const durationMin = block.endMinute - block.startMinute;
  const isShort = durationMin < 60;
  const isTiny = durationMin < 15;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`absolute inset-x-1 flex cursor-pointer flex-col justify-start overflow-hidden rounded-md px-2 text-left text-xs ${
        isTiny ? "leading-3" : "py-1"
      } transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:brightness-125 ${BLOCK_STYLES[block.style].className} ${
        block.faded ? "opacity-60" : ""
      }`}
      style={{ top: top + 1, height: scale.top(block.endMinute) - top - 2 }}
    >
      <div className={isShort ? "flex gap-1.5" : ""}>
        <div className="truncate font-medium">{block.title}</div>
        <div className="shrink-0 tabular-nums opacity-70">{formatTimeRange(block.start, block.end, timeZone)}</div>
      </div>
    </button>
  );
}
