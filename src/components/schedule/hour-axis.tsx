"use client";

import { useClockFormat } from "@/components/time/clock-format";
import { formatHour } from "@/lib/time/clock";
import type { TimeScale } from "./time-scale";

export function HourAxis({ scale }: { scale: TimeScale }) {
  const clock = useClockFormat();
  return (
    <div className="relative" style={{ height: scale.height }}>
      {scale.hours.slice(1).map((hour) => (
        <span
          key={hour}
          className="absolute right-1 -translate-y-1/2 text-[11px] whitespace-nowrap text-muted-foreground tabular-nums md:right-2"
          style={{ top: scale.top(hour * 60) }}
        >
          {formatHour(hour, clock)}
        </span>
      ))}
    </div>
  );
}
