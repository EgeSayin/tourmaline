import { CircleCheck, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Task } from "@/lib/items";
import { formatLocalDate } from "@/lib/time/format";
import { setTaskDoneAction } from "@/server/items/actions";

/** Marks `task`, or with `date` its occurrence on that local date, done as a whole, or reopens it. */
export function TaskDoneButton({ task, date, onChanged }: { task: Task; date: string | null; onChanged: () => void }) {
  const [pending, startTransition] = useTransition();
  const done = date ? task.overrides.some((override) => override.date === date && override.done) : task.done;
  const which = date ? ` ${formatLocalDate(date)}` : "";

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setTaskDoneAction(task.id, date, !done);
          onChanged();
        })
      }
    >
      {done ? <RotateCcw /> : <CircleCheck />}
      {done ? `Reopen${which}` : `Mark${which} done`}
    </Button>
  );
}
