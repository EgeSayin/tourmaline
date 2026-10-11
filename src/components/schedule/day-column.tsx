import type { CalendarBlock } from "@/lib/calendar-blocks";
import type { TimeZone } from "@/lib/time/time-zone";
import { NowLine } from "./now-line";
import { ScheduleBlock } from "./schedule-block";
import type { TimeScale } from "./time-scale";

export function DayColumn({
  date,
  blocks,
  scale,
  timeZone,
  onSelect,
  label,
  className = "",
}: {
  date: string;
  label: string;
  blocks: CalendarBlock[];
  scale: TimeScale;
  timeZone: TimeZone;
  onSelect: (block: CalendarBlock) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`relative border-l ${className}`}
      style={{
        height: scale.height,
        // A line every hour, and a fainter one every quarter.
        backgroundImage:
          "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(color-mix(in oklch, var(--border) 40%, transparent) 1px, transparent 1px)",
        backgroundSize: `100% ${scale.hourHeight}px, 100% ${scale.hourHeight / 4}px`,
      }}
    >
      <NowLine date={date} scale={scale} timeZone={timeZone} />
      {blocks.map((block) => (
        <ScheduleBlock
          key={block.key}
          block={block}
          scale={scale}
          timeZone={timeZone}
          onSelect={() => onSelect(block)}
        />
      ))}
    </div>
  );
}
