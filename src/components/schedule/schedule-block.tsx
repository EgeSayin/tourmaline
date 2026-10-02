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
  const isTiny = block.endMinute - block.startMinute < 15;
  const label = `${block.item.title} ${formatTimeRange(block.start, block.end, timeZone)}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      title={label}
      className={`absolute inset-x-0.5 flex cursor-pointer flex-col justify-start overflow-hidden rounded-md px-1 text-left text-xs md:inset-x-1 md:px-2 ${
        isTiny ? "leading-3" : "py-1"
      } transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:brightness-125 ${BLOCK_STYLES[block.style].className} ${
        block.faded ? "opacity-60" : ""
      }`}
      style={{ top: top + 1, height: scale.top(block.endMinute) - top - 2 }}
    >
      <div className="truncate font-medium">{block.item.title}</div>
    </button>
  );
}
