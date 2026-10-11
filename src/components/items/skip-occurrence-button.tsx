import { CalendarX } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
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
  const [pending, startTransition] = useTransition();
  const name = `Skip ${formatLocalDate(date)}`;

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "sm" : "default"}
      aria-label={name}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await skipOccurrenceAction(itemId, date);
          onSkipped?.();
        })
      }
    >
      <CalendarX />
      {pending ? "Skipping…" : compact ? "Skip" : name}
    </Button>
  );
}
