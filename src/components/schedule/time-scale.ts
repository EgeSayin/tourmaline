import type { CalendarBlock } from "@/lib/calendar-blocks";

const PX_PER_HOUR = 56;

export interface TimeScale {
  /** Whole hours shown, from the earliest block's hour up to the latest block's end. */
  hours: number[];
  height: number;
  /** Vertical position in pixels of a local minute of the day. */
  top: (minuteOfDay: number) => number;
}

export function timeScaleFor(blocks: CalendarBlock[]): TimeScale {
  const firstHour = Math.min(...blocks.map((block) => Math.floor(block.startMinute / 60)));
  const lastHour = Math.max(...blocks.map((block) => Math.ceil(block.endMinute / 60)));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);

  return {
    hours,
    height: hours.length * PX_PER_HOUR,
    top: (minuteOfDay) => ((minuteOfDay - firstHour * 60) / 60) * PX_PER_HOUR,
  };
}
