import { Check, Pin, PinOff, Undo2, X } from "lucide-react";
import { ActionButton } from "@/components/forms/action-button";
import type { BlockPlacement } from "@/lib/calendar-blocks";
import type { PlacementStatus } from "@/lib/placements";
import { setPlacementPinnedAction, setPlacementStatusAction } from "@/server/items/actions";

/**
 * What a block's state allows: check it off (early, before it starts), mark it missed once started, pin or unpin it
 * until it ends, and undo a check-off or a miss.
 */
export function PlacementActions({ placement, onDone }: { placement: BlockPlacement; onDone?: () => void }) {
  const { ref, state, pinned } = placement;
  const setStatus = (status: PlacementStatus) => () => setPlacementStatusAction(ref, status);

  return (
    <div className="flex flex-wrap gap-2">
      {state === "done" || state === "missed" ? (
        <ActionButton size="sm" variant="outline" action={setStatus("planned")} onDone={onDone}>
          <Undo2 />
          Undo {state}
        </ActionButton>
      ) : (
        <>
          <ActionButton size="sm" action={setStatus("done")} onDone={onDone}>
            <Check />
            {state === "planned" ? "Done early" : "Done"}
          </ActionButton>
          {state !== "planned" && (
            <ActionButton size="sm" variant="outline" action={setStatus("missed")} onDone={onDone}>
              <X />
              Missed
            </ActionButton>
          )}
          {state !== "to-review" && (
            <ActionButton
              size="sm"
              variant="outline"
              action={() => setPlacementPinnedAction(ref, !pinned)}
              onDone={onDone}
            >
              {pinned ? <PinOff /> : <Pin />}
              {pinned ? "Unpin" : "Pin"}
            </ActionButton>
          )}
        </>
      )}
    </div>
  );
}
