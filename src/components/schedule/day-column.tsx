import type { CalendarBlock, Laid } from "@/lib/calendar-blocks";
import type { DayRange } from "@/lib/time/time-of-day";
import type { TimeZone } from "@/lib/time/time-zone";
import { DowntimeBands } from "./downtime-bands";
import { NowLine } from "./now-line";
import { BufferStrip, ScheduleBlock } from "./schedule-block";
import { hourLines, type TimeScale } from "./time-scale";

export function DayColumn({
  now,
  date,
  blocks,
  downtime,
  scale,
  timeZone,
  onSelect,
  label,
  className = "",
}: {
  now: Date | null;
  date: string;
  label: string;
  blocks: Laid<CalendarBlock>[];
  downtime: readonly DayRange[];
  scale: TimeScale;
  timeZone: TimeZone;
  onSelect: (block: CalendarBlock) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`relative border-l ${className}`} style={hourLines(scale, 4)}>
      <DowntimeBands ranges={downtime} scale={scale} />
      <NowLine now={now} date={date} scale={scale} timeZone={timeZone} />
      {blocks.map((block) =>
        block.buffers.map((buffer) => (
          <BufferStrip
            key={`${block.key}-${buffer.startMinute}`}
            block={block}
            buffer={buffer}
            scale={scale}
            onSelect={() => onSelect(block)}
          />
        )),
      )}
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
