import { CalendarX } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatLocalDate } from "@/lib/time/format";
import { skipOccurrenceAction } from "@/server/items/actions";

/** Skips the occurrence of series `itemId` on local date `date`. */
export function SkipOccurrenceButton({
  itemId,
  date,
  onSkipped,
}: {
  itemId: string;
  date: string;
  onSkipped?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await skipOccurrenceAction(itemId, date);
          onSkipped?.();
        })
      }
    >
      <CalendarX />
      {pending ? "Skipping…" : `Skip ${formatLocalDate(date)}`}
    </Button>
  );
}
