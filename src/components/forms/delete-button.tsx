import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/** Asks for confirmation, then runs `onDelete` and, once it's done, `onDeleted`. */
export function DeleteButton({ onDelete, onDeleted }: { onDelete: () => Promise<void>; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
        <Trash2 />
        Delete
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await onDelete();
            onDeleted();
          })
        }
      >
        {pending ? "Deleting…" : "Confirm delete"}
      </Button>
      <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
