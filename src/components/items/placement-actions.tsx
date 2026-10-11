import { Check, Pin, PinOff, Undo2, X } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { BlockPlacement } from "@/lib/calendar-blocks";
import type { PlacementStatus } from "@/lib/placements";
import { setPlacementPinnedAction, setPlacementStatusAction } from "@/server/items/actions";

/**
 * What a block's state allows: check it off (early, before it starts), mark it missed once started, pin or unpin it
 * until it ends, and undo a check-off or a miss.
 */
export function PlacementActions({ placement, onDone }: { placement: BlockPlacement; onDone?: () => void }) {
  const [pending, startTransition] = useTransition();
  const { ref, state, pinned } = placement;
  const run = (action: () => Promise<void>) =>
    startTransition(async () => {
      await action();
      onDone?.();
    });
  const setStatus = (status: PlacementStatus) => run(() => setPlacementStatusAction(ref, status));

  return (
    <div className="flex flex-wrap gap-2">
      {state === "done" || state === "missed" ? (
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus("planned")}>
          <Undo2 />
          Undo {state === "done" ? "done" : "missed"}
        </Button>
      ) : (
        <>
          <Button type="button" size="sm" disabled={pending} onClick={() => setStatus("done")}>
            <Check />
            {state === "planned" ? "Done early" : "Done"}
          </Button>
          {state !== "planned" && (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus("missed")}>
              <X />
              Missed
            </Button>
          )}
          {state !== "to-review" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => setPlacementPinnedAction(ref, !pinned))}
            >
              {pinned ? <PinOff /> : <Pin />}
              {pinned ? "Unpin" : "Pin"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
