import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "./action-button";

export function DeleteButton({
  onDelete,
  onDeleted,
}: {
  onDelete: () => Promise<boolean | void>;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return confirming ? (
    <div className="flex gap-2">
      <ActionButton variant="destructive" action={onDelete} onDone={onDeleted}>
        Confirm delete
      </ActionButton>
      <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  ) : (
    <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
      <Trash2 />
      Delete
    </Button>
  );
}
