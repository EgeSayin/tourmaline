"use client";

import { CalendarDays, Hourglass } from "lucide-react";
import { useState } from "react";
import { SegmentedControl } from "@/components/controls/segmented-control";
import { AddItemButton, ItemPanel } from "@/components/items/item-panel";
import { useItemPanel } from "@/components/items/item-panel-state";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScheduleLegend } from "./schedule-legend";

type View = "calendar" | "queue";

type List = "review" | "queue";

/**
 * Tablet and up: three columns (lists, calendar, tools), each a header over a section; the lists header is empty.
 * The lists section switches between the blocks to review and the queue, opening on the review while it has any.
 * The tools section holds the add/edit panel; while it's closed, the calendar section takes its place.
 * Phones: the headers stack on top and a bottom tab bar switches between the calendar and the lists.
 */
export function ScheduleView({
  calendarHeader,
  calendar,
  queue,
  queueCount,
  review,
  reviewCount,
}: {
  calendarHeader: React.ReactNode;
  calendar: React.ReactNode;
  queue: React.ReactNode;
  queueCount: number;
  review: React.ReactNode;
  reviewCount: number;
}) {
  const [view, setView] = useState<View>("calendar");
  const [list, setList] = useState<List>(reviewCount > 0 ? "review" : "queue");
  const panelOpen = useItemPanel().mode.kind !== "closed";
  const shownOn = (target: View) => (view === target ? "" : "hidden md:block");
  // The phone tab holds both lists.
  const waiting = queueCount + reviewCount;

  return (
    <div className="grid pb-20 md:h-dvh md:grid-cols-[13rem_minmax(0,1fr)_20rem] md:grid-rows-[auto_minmax(0,1fr)] md:pb-0 lg:grid-cols-[16rem_minmax(0,1fr)_24rem]">
      <header className="hidden min-h-16 border-r border-b md:block" />
      <header className="flex min-h-16 items-center border-b px-4">{calendarHeader}</header>
      <header className="flex min-h-16 items-center justify-between gap-2 border-b px-4 md:justify-end md:border-l">
        <ThemeToggle />
        <AddItemButton />
      </header>

      <div className={`space-y-4 overflow-y-auto p-4 md:border-r ${shownOn("queue")}`}>
        <SegmentedControl
          label="Lists"
          value={list}
          onChange={setList}
          options={[
            {
              value: "review",
              label: counted("To review", reviewCount),
              content: (
                <>
                  To review <Count n={reviewCount} />
                </>
              ),
            },
            {
              value: "queue",
              label: counted("Queue", queueCount),
              content: (
                <>
                  Queue <Count n={queueCount} />
                </>
              ),
            },
          ]}
          className="grid grid-cols-2 gap-1 rounded-lg border p-1"
          optionClassName={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "aria-checked:bg-secondary aria-checked:text-secondary-foreground",
          )}
        />
        <section aria-label="To review" hidden={list !== "review"}>
          {review}
        </section>
        <section aria-label="Task queue" hidden={list !== "queue"}>
          {queue}
        </section>
      </div>
      <section
        aria-label="Calendar"
        className={`space-y-3 overflow-y-auto p-4 ${panelOpen ? "" : "md:col-span-2"} ${shownOn("calendar")}`}
      >
        <ScheduleLegend />
        {calendar}
      </section>
      <ItemPanel />

      <SegmentedControl
        label="View"
        value={view}
        onChange={setView}
        options={[
          {
            value: "calendar",
            label: "Calendar",
            content: (
              <>
                <CalendarDays className="size-5" />
                Calendar
              </>
            ),
          },
          {
            value: "queue",
            label: counted("Queue", waiting),
            content: (
              <>
                <span className="relative">
                  <Hourglass className="size-5" />
                  <Count n={waiting} className="absolute -top-1.5 -right-2.5" />
                </span>
                Queue
              </>
            ),
          },
        ]}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        optionClassName="flex flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground aria-checked:text-foreground"
      />
    </div>
  );
}

/** The name, with how many need attention, for screen readers. */
function counted(name: string, count: number) {
  return count > 0 ? `${name} (${count})` : name;
}

/** An amber count, shown only while there's something to resolve. */
function Count({ n, className = "" }: { n: number; className?: string }) {
  return (
    n > 0 && (
      <span
        className={`min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] leading-4 font-semibold text-white tabular-nums ${className}`}
      >
        {n}
      </span>
    )
  );
}
