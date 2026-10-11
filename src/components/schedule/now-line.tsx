"use client";

import { useCurrentMinute } from "@/hooks/use-current-minute";
import { toLocal } from "@/lib/time/local-time";
import { toTimeInputValue } from "@/lib/time/time-of-day";
import type { TimeZone } from "@/lib/time/time-zone";
import type { TimeScale } from "./time-scale";

/** A line across the column of local `date` at the current time, while it's `date` and the time is on `scale`. */
export function NowLine({ date, scale, timeZone }: { date: string; scale: TimeScale; timeZone: TimeZone }) {
  const now = useCurrentMinute();
  if (!now) return null;
  const local = toLocal(now, timeZone);
  const top = scale.top(local.minuteOfDay);
  if (local.date !== date || top < 0 || top > scale.height) return null;

  return (
    <div
      role="separator"
      aria-label={`Now, ${toTimeInputValue(local.minuteOfDay)}`}
      className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500 dark:border-red-400"
      style={{ top: top - 1 }}
    >
      <span className="absolute -top-[5px] -left-1 size-2 rounded-full bg-red-500 dark:bg-red-400" />
    </div>
  );
}
