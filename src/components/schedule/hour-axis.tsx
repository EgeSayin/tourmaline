import type { TimeScale } from "./time-scale";

export function HourAxis({ scale }: { scale: TimeScale }) {
  return (
    <div className="relative" style={{ height: scale.height }}>
      {scale.hours.slice(1).map((hour) => (
        <span
          key={hour}
          className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums"
          style={{ top: scale.top(hour * 60) }}
        >
          {String(hour).padStart(2, "0")}:00
        </span>
      ))}
    </div>
  );
}
