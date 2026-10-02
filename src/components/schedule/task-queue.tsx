"use client";

import { Popover } from "@base-ui/react/popover";
import { Hourglass } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { useItemPanel } from "@/components/items/item-panel";
import { Button } from "@/components/ui/button";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { FlexibleItem } from "@/lib/items";
import type { TimeZone } from "@/lib/time-zone";

const TITLE = "Task queue";

/**
 * A header button listing the tasks that don't fit before their deadline; picking one opens it for editing.
 * `tasks` hold the remaining time, `flexibleItems` the saved tasks.
 */
export function TaskQueue({
  tasks,
  flexibleItems,
  timeZone,
}: {
  tasks: FlexibleItem[];
  flexibleItems: FlexibleItem[];
  timeZone: TimeZone;
}) {
  const { openEdit } = useItemPanel();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [open, setOpen] = useState(false);
  if (tasks.length === 0) return null;

  const itemsById = new Map(flexibleItems.map((item) => [item.id, item]));
  const select = (task: FlexibleItem) => {
    setOpen(false);
    const item = itemsById.get(task.id);
    if (item) openEdit(item);
  };
  const buttonProps = {
    variant: "outline",
    "aria-label": `${TITLE}: ${tasks.length === 1 ? "1 task" : `${tasks.length} tasks`}`,
    className: "text-amber-700 dark:text-amber-400",
  } as const;
  const buttonContent = (
    <>
      <Hourglass />
      {tasks.length}
      <span className="hidden md:inline">queued</span>
    </>
  );
  const list = <QueueList tasks={tasks} timeZone={timeZone} onSelect={select} />;

  if (!isDesktop) {
    return (
      <>
        <Button {...buttonProps} onClick={() => setOpen(true)}>
          {buttonContent}
        </Button>
        <BottomSheet open={open} onClose={() => setOpen(false)} title={TITLE} showTitle>
          {list}
        </BottomSheet>
      </>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger render={<Button {...buttonProps} />}>{buttonContent}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Popover.Popup className="flex max-h-[60dvh] w-80 flex-col gap-3 overflow-y-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg transition duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Popover.Title className="font-semibold">{TITLE}</Popover.Title>
            {list}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function QueueList({
  tasks,
  timeZone,
  onSelect,
}: {
  tasks: FlexibleItem[];
  timeZone: TimeZone;
  onSelect: (task: FlexibleItem) => void;
}) {
  return (
    <>
      <p className="-mt-2 text-sm text-muted-foreground">
        Not enough free time before the deadline. Edit or delete a task to make room.
      </p>
      <ul className="-mx-2 flex flex-col">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              className="flex w-full flex-col rounded-md px-2 py-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => onSelect(task)}
            >
              <span className="font-medium">{task.title}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatDuration(task.durationMin)} left · due {formatDateTime(task.deadline, timeZone)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
