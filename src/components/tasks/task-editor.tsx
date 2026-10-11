"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ItemForm } from "@/components/items/item-form";
import { buttonVariants } from "@/components/ui/button";
import type { TimeZone } from "@/lib/time/time-zone";
import type { ItemSchedule, TaskEntry } from "@/server/tasks";
import { TaskBlocks } from "./task-blocks";
import { TaskOccurrences } from "./task-occurrences";

/** Edits `task` with its `schedule`, or adds a new item without one; closing or saving goes back to the list. */
export function TaskEditor({
  task,
  schedule,
  timeZone,
}: {
  task: TaskEntry | null;
  schedule: ItemSchedule;
  timeZone: TimeZone;
}) {
  const router = useRouter();
  return (
    <aside aria-label={task ? "Edit item" : "New item"} className="flex flex-col gap-4 overflow-y-auto p-4 md:border-l">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{task ? "Edit item" : "New item"}</h2>
          {!task && (
            <p className="text-sm text-muted-foreground">
              Fixed items keep their time; flexible ones are scheduled for you.
            </p>
          )}
        </div>
        <Link href="/tasks" aria-label="Close" className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
          <X />
        </Link>
      </div>
      <ItemForm
        key={task?.id ?? "new"}
        item={task?.target.item}
        timeZone={timeZone}
        onDone={() => router.push("/tasks")}
      />
      {task?.recurring ? (
        <TaskOccurrences item={task.target.item} occurrences={schedule.occurrences} timeZone={timeZone} />
      ) : (
        task?.kind === "task" && <TaskBlocks blocks={schedule.blocks} timeZone={timeZone} />
      )}
    </aside>
  );
}
