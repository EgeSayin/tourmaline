"use client";

import { Slider } from "@base-ui/react/slider";
import { useClockFormat } from "@/components/time/clock-format";
import { formatTimeOfDay } from "@/lib/time/clock";
import { MINUTES_PER_DAY } from "@/lib/time/time-of-day";

const STEP_MIN = 15;
const THUMB_LABELS = ["From", "Until"];

/** Picks a range of the day, `[startMinute, endMinute]`, in quarter hours, with each end read out as a time. */
export function TimeRangeSlider({
  value,
  onValueChange,
}: {
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
}) {
  const clock = useClockFormat();
  return (
    <Slider.Root
      value={value}
      onValueChange={(next) => onValueChange(next as [number, number])}
      min={0}
      max={MINUTES_PER_DAY}
      step={STEP_MIN}
      minStepsBetweenValues={1}
      thumbAlignment="edge"
      className="w-full"
    >
      <Slider.Control className="relative flex w-full touch-none items-center py-2 select-none">
        <Slider.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-muted select-none">
          <Slider.Indicator className="h-full bg-primary select-none" />
        </Slider.Track>
        {THUMB_LABELS.map((label, index) => (
          <Slider.Thumb
            key={label}
            index={index}
            getAriaLabel={() => label}
            getAriaValueText={(_, minute) => formatTimeOfDay(minute, clock)}
            className="relative block size-4 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3"
          />
        ))}
      </Slider.Control>
    </Slider.Root>
  );
}
