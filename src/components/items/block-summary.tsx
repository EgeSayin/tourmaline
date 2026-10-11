import type { CalendarBlock } from "@/lib/calendar-blocks";
import { formatLocalDate, formatTimeRange } from "@/lib/time/format";
import { toLocal } from "@/lib/time/local-time";
import type { TimeZone } from "@/lib/time/time-zone";
import { PLACEMENT_STATE_LABELS } from "./placement-state";

export function BlockSummary({
  block: { start, end, placement },
  timeZone,
}: {
  block: Pick<CalendarBlock, "start" | "end" | "placement">;
  timeZone: TimeZone;
}) {
  return (
    <p className="text-sm tabular-nums">
      {formatLocalDate(toLocal(start, timeZone).date)} · {formatTimeRange(start, end, timeZone)}
      {placement && (
        <span className="text-muted-foreground">
          {" "}
          · {PLACEMENT_STATE_LABELS[placement.state]}
          {placement.pinned && ", pinned"}
        </span>
      )}
    </p>
  );
}
