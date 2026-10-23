"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type Segment, SegmentedControl } from "@/components/controls/segmented-control";
import { ItemForm } from "@/components/items/item-form";
import { OccurrenceForm } from "@/components/items/occurrence-form";
import { formatLocalDate } from "@/lib/time/format";
import { buttonVariants } from "@/components/ui/button";
import type { Category } from "@/lib/categories";
import type { TimeZone } from "@/lib/time/time-zone";
import type { ItemEntry, ItemSchedule, OccurrenceEdit } from "@/server/tasks";
import { TaskBlocks } from "./task-blocks";
import { TaskOccurrences } from "./task-occurrences";

type Scope = "one" | "later";

const SCOPE_OPTIONS = [
  { value: "one", label: "Only this one" },
  { value: "later", label: "This and later ones" },
] satisfies Segment<Scope>[];

/** With an `occurrence` of a series, it edits that one alone or, from it on, the series. */
export function TaskEditor({
  task,
  occurrence,
  schedule,
  categories,
  timeZone,
}: {
  task: ItemEntry | null;
  occurrence: OccurrenceEdit | null;
  schedule: ItemSchedule;
  categories: Category[];
  timeZone: TimeZone;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("one");
  const close = () => router.push("/tasks");
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
          {occurrence && (
            <p className="text-sm text-muted-foreground">The occurrence on {formatLocalDate(occurrence.date)}</p>
          )}
        </div>
        <Link href="/tasks" aria-label="Close" className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
          <X />
        </Link>
      </div>
      {occurrence && (
        <SegmentedControl
          label="Edit"
          value={scope}
          onChange={setScope}
          options={SCOPE_OPTIONS}
          className="flex self-start"
        />
      )}
      {occurrence && scope === "one" ? (
        <OccurrenceForm occurrence={occurrence} timeZone={timeZone} onDone={close} />
      ) : (
        <ItemForm
          item={occurrence?.series ?? task?.target.item}
          categories={categories}
          timeZone={timeZone}
          onDone={close}
        />
      )}
      {task?.recurring ? (
        <TaskOccurrences item={task.target.item} occurrences={schedule.occurrences} timeZone={timeZone} />
      ) : (
        task?.kind === "task" && <TaskBlocks blocks={schedule.blocks} timeZone={timeZone} />
      )}
    </aside>
  );
}
