import { FormSection } from "@/components/forms/form-fields";
import { formatLocalWeekday, formatTimeRange } from "@/lib/time/format";
import { toLocal } from "@/lib/time/local-time";
import type { TimeZone } from "@/lib/time/time-zone";
import type { OpenedBlock } from "./item-panel-state";
import { PlacementActions } from "./placement-actions";
import { PLACEMENT_STATE_LABELS } from "./placement-state";

/** The block the panel was opened from: its time, its state and what can be done with it. */
export function BlockSection({
  block,
  timeZone,
  onDone,
}: {
  block: OpenedBlock;
  timeZone: TimeZone;
  onDone: () => void;
}) {
  return (
    <FormSection title="This block">
      <p className="text-sm">
        {formatLocalWeekday(toLocal(block.start, timeZone).date)} {formatTimeRange(block.start, block.end, timeZone)}
        <span className="text-muted-foreground">
          {" "}
          · {PLACEMENT_STATE_LABELS[block.state]}
          {block.pinned && ", pinned"}
        </span>
      </p>
      <PlacementActions placement={block} onDone={onDone} />
    </FormSection>
  );
}
