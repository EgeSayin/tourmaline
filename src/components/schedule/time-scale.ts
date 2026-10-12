import type { CalendarBlock } from "@/lib/calendar-blocks";
import { type Downtime, shownMinutes } from "@/lib/downtime";
import { SLOT_MIN } from "@/lib/placements";

/** A one-slot block, less its 2px gap, holds one 12px line of text. */
const PX_PER_SLOT = 14;
const PX_PER_HOUR = (60 / SLOT_MIN) * PX_PER_SLOT;

export interface TimeScale {
  hours: number[];
  height: number;
  hourHeight: number;
  top: (minuteOfDay: number) => number;
}

/** Whole hours from `firstHour` up to `lastHour`. */
export function timeScale(firstHour: number, lastHour: number, hourHeight: number): TimeScale {
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  return {
    hours,
    height: hours.length * hourHeight,
    hourHeight,
    top: (minuteOfDay) => ((minuteOfDay - firstHour * 60) / 60) * hourHeight,
  };
}

/** The hours of `shownMinutes(downtime)`, stretched to every block and buffer. */
export function timeScaleFor(blocks: CalendarBlock[], downtime: Downtime): TimeScale {
  const shown = shownMinutes(downtime);
  const spans = blocks.flatMap((block) => [block, ...block.buffers]);
  const firstMinute = Math.min(shown.startMinute, ...spans.map((span) => span.startMinute));
  const lastMinute = Math.max(shown.endMinute, ...spans.map((span) => span.endMinute));
  return timeScale(Math.floor(firstMinute / 60), Math.ceil(lastMinute / 60), PX_PER_HOUR);
}

/** A line every hour, and a fainter one `linesPerHour` times an hour. */
export function hourLines(scale: TimeScale, linesPerHour: number): React.CSSProperties {
  return {
    height: scale.height,
    backgroundImage:
      "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(color-mix(in oklch, var(--border) 40%, transparent) 1px, transparent 1px)",
    backgroundSize: `100% ${scale.hourHeight}px, 100% ${scale.hourHeight / linesPerHour}px`,
  };
}
