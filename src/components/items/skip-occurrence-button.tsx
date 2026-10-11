import { CalendarX } from "lucide-react";
import { ActionButton } from "@/components/forms/action-button";
import { formatLocalDate } from "@/lib/time/format";
import { skipOccurrenceAction } from "@/server/items/actions";

/** Skips the occurrence of series `itemId` on local date `date`; `compact` as in `TaskDoneButton`. */
export function SkipOccurrenceButton({
  itemId,
  date,
  compact = false,
  onSkipped,
}: {
  itemId: string;
  date: string;
  compact?: boolean;
  onSkipped?: () => void;
}) {
  const name = `Skip ${formatLocalDate(date)}`;
  return (
    <ActionButton
      variant="ghost"
      size={compact ? "sm" : "default"}
      aria-label={name}
      action={() => skipOccurrenceAction(itemId, date)}
      onDone={onSkipped}
    >
      <CalendarX />
      {compact ? "Skip" : name}
    </ActionButton>
  );
}
