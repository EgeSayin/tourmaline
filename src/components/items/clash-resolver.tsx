import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CLASH_RESOLUTION_FIELD } from "@/lib/item-form";
import { CLASHES_SHOWN } from "@/lib/settings";
import { formatLocalDate, formatTimeRange } from "@/lib/time/format";
import { toLocal } from "@/lib/time/local-time";
import type { TimeZone } from "@/lib/time/time-zone";
import type { Clash } from "@/server/items/clashes";
import type { ClashResolution } from "@/server/items/item-commands";

/** What the item being saved overlaps, with the ways to save it anyway; takes the place of the form's buttons. */
export function ClashResolver({
  clashes,
  timeZone,
  pending,
  onCancel,
}: {
  clashes: Clash[];
  timeZone: TimeZone;
  pending: boolean;
  onCancel: () => void;
}) {
  const bumpable = clashes.some((clash) => !clash.mandatory);
  const more = clashes.length - CLASHES_SHOWN;
  const resolve = (resolution: ClashResolution) => ({
    type: "submit" as const,
    name: CLASH_RESOLUTION_FIELD,
    value: resolution,
  });

  return (
    <section
      aria-label="Clashes"
      className="flex flex-col gap-3 rounded-lg border border-amber-500/60 bg-amber-50 p-3 text-sm dark:bg-amber-950/40"
    >
      <p className="flex items-center gap-2 font-medium">
        <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
        Overlaps with
      </p>
      <ul className="flex flex-col gap-1">
        {clashes.slice(0, CLASHES_SHOWN).map((clash) => (
          <li key={clash.id} className="flex items-baseline justify-between gap-2">
            <span>
              <span className="font-medium">{clash.title}</span>{" "}
              <span className="whitespace-nowrap text-muted-foreground tabular-nums">
                {formatLocalDate(toLocal(clash.start, timeZone).date)}{" "}
                {formatTimeRange(clash.start, clash.end, timeZone)}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{clash.mandatory ? "Mandatory" : "Optional"}</span>
          </li>
        ))}
        {more > 0 && <li className="text-muted-foreground">and {more} more</li>}
      </ul>
      <p className="text-xs text-muted-foreground">
        {bumpable ? "Bumping moves the optional ones to the queue. " : ""}Mandatory items can&apos;t be bumped.
      </p>
      <div className="flex flex-wrap gap-2">
        {bumpable && (
          <Button {...resolve("bump")} disabled={pending}>
            Bump and save
          </Button>
        )}
        <Button {...resolve("keep")} variant={bumpable ? "outline" : "default"} disabled={pending}>
          Save anyway
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
