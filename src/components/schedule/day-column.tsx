import type { CalendarBlock } from "@/lib/calendar-blocks";
import type { TimeZone } from "@/lib/time/time-zone";
import { NowLine } from "./now-line";
import { ScheduleBlock } from "./schedule-block";
import type { TimeScale } from "./time-scale";

const QUARTERS = [15, 30, 45];

export function DayColumn({
  date,
  blocks,
  scale,
  timeZone,
  onSelect,
  label,
  className = "",
}: {
  /** Local `YYYY-MM-DD`. */
  date: string;
  /** The day, as screen readers announce the column. */
  label: string;
  blocks: CalendarBlock[];
  scale: TimeScale;
  timeZone: TimeZone;
  onSelect: (block: CalendarBlock) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`relative border-l ${className}`} style={{ height: scale.height }}>
      {scale.hours.slice(1).map((hour) => (
        <div key={hour} className="absolute inset-x-0 border-t" style={{ top: scale.top(hour * 60) }} />
      ))}
      {scale.hours.flatMap((hour) =>
        QUARTERS.map((minute) => (
          <div
            key={`${hour}:${minute}`}
            className="absolute inset-x-0 border-t border-border/40"
            style={{ top: scale.top(hour * 60 + minute) }}
          />
        )),
      )}
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
