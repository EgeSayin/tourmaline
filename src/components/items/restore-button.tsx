import { Undo2 } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { restoreBumpedAction } from "@/server/items/actions";

/** Puts the bumped one-off fixed item `itemId`, or with `date` its occurrence on that local date, back on the calendar. */
export function RestoreButton({ itemId, date, title }: { itemId: string; date: string | null; title: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={`Restore ${title}`}
      disabled={pending}
      onClick={() => startTransition(() => restoreBumpedAction(itemId, date))}
    >
      <Undo2 />
      {pending ? "Restoring…" : "Restore"}
    </Button>
  );
}
