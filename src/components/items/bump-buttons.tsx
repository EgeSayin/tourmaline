"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { toastChangedMeanwhile, toastNotSaved } from "@/components/forms/action-toasts";
import { FormSection } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { PlacementRef } from "@/lib/placements";
import { BUMP_PRESETS_MIN } from "@/lib/settings";
import { MINUTES_PER_DAY } from "@/lib/time/time-of-day";
import type { BumpOutcome } from "@/server/items/item-commands";
import { bumpTaskAction } from "@/server/items/actions";

const UNITS = { hours: 60, days: MINUTES_PER_DAY };
type Unit = keyof typeof UNITS;

const REFUSED = {
  "past-due": "It's due before then.",
  "no-room": "No room for it before it's due, so nothing changed.",
} satisfies Record<Exclude<BumpOutcome, "bumped">, string>;

/** Whole days as days, the rest as hours. */
function formatBump(minutes: number): string {
  const [count, unit] = minutes % MINUTES_PER_DAY === 0 ? [minutes / MINUTES_PER_DAY, "day"] : [minutes / 60, "hour"];
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** Bumps a planned block's task (see `bumpTask`) by a preset amount, or by a number of hours or days. */
export function BumpButtons({ placementRef, onDone }: { placementRef: PlacementRef; onDone?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [count, setCount] = useState("1");
  const [unit, setUnit] = useState<Unit>("days");
  const countId = useId();
  const customMin = /^\d+$/.test(count) ? Number(count) * UNITS[unit] : 0;

  const bump = (byMin: number) =>
    startTransition(async () => {
      try {
        const outcome = await bumpTaskAction(placementRef, byMin);
        if (outcome === false) toastChangedMeanwhile();
        else if (outcome === "bumped") onDone?.();
        else toast(REFUSED[outcome]);
      } catch {
        toastNotSaved();
      }
    });

  return (
    <FormSection title="Bump">
      <p className="text-sm text-muted-foreground">
        Plans it again from this block&apos;s start plus the amount. Its later blocks stay.
      </p>
      <div className="flex flex-wrap gap-2">
        {BUMP_PRESETS_MIN.map((minutes) => (
          <Button key={minutes} size="sm" variant="outline" disabled={pending} onClick={() => bump(minutes)}>
            {formatBump(minutes)}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor={countId} className="sr-only">
          Bump by
        </Label>
        <Input
          id={countId}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={count}
          onChange={(event) => setCount(event.target.value)}
          className="w-20"
        />
        <NativeSelect aria-label="Unit" value={unit} onChange={(event) => setUnit(event.target.value as Unit)}>
          <NativeSelectOption value="hours">hours</NativeSelectOption>
          <NativeSelectOption value="days">days</NativeSelectOption>
        </NativeSelect>
        <Button variant="outline" disabled={pending || customMin === 0} onClick={() => bump(customMin)}>
          Bump
        </Button>
      </div>
    </FormSection>
  );
}
