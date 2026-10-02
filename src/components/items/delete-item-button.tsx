import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteItemAction } from "@/server/items/actions";

export function DeleteItemButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
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
            await deleteItemAction(id);
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
