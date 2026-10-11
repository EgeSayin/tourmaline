import { CircleCheck, RotateCcw } from "lucide-react";
import { ActionButton } from "@/components/forms/action-button";
import type { Task } from "@/lib/items";
import { formatLocalDate } from "@/lib/time/format";
import { setTaskDoneAction } from "@/server/items/actions";

/**
 * Marks `task`, or with `date` its occurrence on that local date, done as a whole, or reopens it. `compact` is small
 * and leaves the date out of the visible label, for where the date is already shown.
 */
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
  const done = date ? task.overrides.some((override) => override.date === date && override.done) : task.done;
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
