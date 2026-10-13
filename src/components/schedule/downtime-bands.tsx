import type { DayRange } from "@/lib/time/time-of-day";
import type { TimeScale } from "./time-scale";

const DOWNTIME_STYLE = "bg-muted-foreground/15";

export function DowntimeBands({ ranges, scale }: { ranges: readonly DayRange[]; scale: TimeScale }) {
  return ranges.map(({ startMinute, endMinute }) => {
    const top = Math.max(0, scale.top(startMinute));
    const bottom = Math.min(scale.height, scale.top(endMinute));
    return (
      bottom > top && (
        <div
          key={startMinute}
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 ${DOWNTIME_STYLE}`}
          style={{ top, height: bottom - top }}
        />
      )
    );
  });
}
