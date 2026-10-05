import type { CalendarBlock } from "@/lib/calendar-blocks";
import { SLOT_MIN } from "@/lib/placements";

/** A one-slot block, less its 2px gap, holds one 12px line of text. */
const PX_PER_SLOT = 14;
const PX_PER_HOUR = (60 / SLOT_MIN) * PX_PER_SLOT;
/** Hours shown when there are no blocks to fit. */
const EMPTY_DAY_HOURS = { first: 8, last: 18 };

export interface TimeScale {
  /** Whole hours shown, from the earliest block's hour up to the latest block's end, or `EMPTY_DAY_HOURS`. */
  hours: number[];
  height: number;
  /** Vertical position in pixels of a local minute of the day. */
  top: (minuteOfDay: number) => number;
}

export function timeScaleFor(blocks: CalendarBlock[]): TimeScale {
  const firstHour =
    blocks.length > 0 ? Math.min(...blocks.map((block) => Math.floor(block.startMinute / 60))) : EMPTY_DAY_HOURS.first;
  const lastHour =
    blocks.length > 0 ? Math.max(...blocks.map((block) => Math.ceil(block.endMinute / 60))) : EMPTY_DAY_HOURS.last;
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);

  return {
    hours,
    height: hours.length * PX_PER_HOUR,
    top: (minuteOfDay) => ((minuteOfDay - firstHour * 60) / 60) * PX_PER_HOUR,
  };
}
