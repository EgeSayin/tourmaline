import { CircleCheck, RotateCcw } from "lucide-react";
import { ActionButton } from "@/components/forms/action-button";
import type { Task } from "@/lib/items";
import { formatLocalDate } from "@/lib/time/format";
import { setTaskDoneAction } from "@/server/items/actions";

/** `compact` leaves the date out of the label, for where it is already shown. */
export function TaskDoneButton({
  task,
  date,
  compact = false,
  onChanged,
}: {
  task: Task;
  date: string | null;
  compact?: boolean;
  onChanged?: () => void;
}) {
  const done = date ? task.occurrences[date] === "done" : task.done;
  const label = (which: string) => (done ? `Reopen${which}` : `Mark${which} done`);
  const name = label(date ? ` ${formatLocalDate(date)}` : "");

  return (
    <ActionButton
      variant="ghost"
      size={compact ? "sm" : "default"}
      aria-label={name}
      action={() => setTaskDoneAction(task.id, date, !done)}
      onDone={onChanged}
    >
      {done ? <RotateCcw /> : <CircleCheck />}
      {compact ? label("") : name}
    </ActionButton>
  );
}
