import type { CalendarBlock } from "@/lib/calendar-blocks";
import type { TimeZone } from "@/lib/time-zone";
import { ScheduleBlock } from "./schedule-block";
import type { TimeScale } from "./time-scale";

export function DayColumn({
  blocks,
  scale,
  timeZone,
  className = "",
}: {
  blocks: CalendarBlock[];
  scale: TimeScale;
  timeZone: TimeZone;
  className?: string;
}) {
  return (
    <div className={`relative border-l ${className}`} style={{ height: scale.height }}>
      {scale.hours.slice(1).map((hour) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-t border-border/60"
          style={{ top: scale.top(hour * 60) }}
        />
      ))}
      {blocks.map((block) => (
        <ScheduleBlock key={block.key} block={block} scale={scale} timeZone={timeZone} />
      ))}
    </div>
  );
}
