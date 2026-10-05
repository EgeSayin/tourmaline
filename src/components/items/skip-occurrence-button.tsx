import { CalendarX } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatLocalDate } from "@/lib/format";
import { parseOccurrenceId } from "@/lib/recurrence";
import { skipOccurrenceAction } from "@/server/items/actions";

export function SkipOccurrenceButton({ occurrenceId, onSkipped }: { occurrenceId: string; onSkipped: () => void }) {
  const [pending, startTransition] = useTransition();
  const { date } = parseOccurrenceId(occurrenceId);

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await skipOccurrenceAction(occurrenceId);
          onSkipped();
        })
      }
    >
      <CalendarX />
      {pending ? "Skipping…" : `Skip ${date && formatLocalDate(date)}`}
    </Button>
  );
}
