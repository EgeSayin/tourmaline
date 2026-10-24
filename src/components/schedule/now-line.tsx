"use client";

import { useClockFormat } from "@/components/time/clock-format";
import { formatTimeOfDay } from "@/lib/time/clock";
import { toLocal } from "@/lib/time/local-time";
import type { TimeZone } from "@/lib/time/time-zone";
import type { TimeScale } from "./time-scale";

/** `now` is the grid's one clock (see `useCurrentMinute`), `null` until it starts. */
export function NowLine({
  now,
  date,
  scale,
  timeZone,
}: {
  now: Date | null;
  date: string;
  scale: TimeScale;
  timeZone: TimeZone;
}) {
  const clock = useClockFormat();
  if (!now) return null;
  const local = toLocal(now, timeZone);
  const top = scale.top(local.minuteOfDay);
  if (local.date !== date || top < 0 || top > scale.height) return null;

  return (
    <div
      role="separator"
      aria-label={`Now, ${formatTimeOfDay(local.minuteOfDay, clock)}`}
      className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-now"
      style={{ top: top - 1 }}
    >
      <span className="absolute -top-[5px] -left-1 size-2 rounded-full bg-now" />
    </div>
  );
}
