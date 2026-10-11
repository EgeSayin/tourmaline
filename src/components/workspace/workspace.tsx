"use client";

import { CalendarDays, Hourglass, ListTodo } from "lucide-react";
import { useState } from "react";
import { SegmentedControl } from "@/components/controls/segmented-control";
import { ItemPanel } from "@/components/items/item-panel";
import { useItemPanel } from "@/components/items/item-panel-state";
import { ReviewList } from "@/components/schedule/review-list";
import { TaskQueue } from "@/components/schedule/task-queue";
import { type AppPage, AppShell } from "@/components/shell/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Calendar } from "@/server/calendar";

type List = "review" | "queue";

/**
 * What every page shows around its middle: the lists on the left (blocks to review and the queue, opening on the
 * review while it has any) and, on the right, `editor` when given, or else the panel for what's clicked.
 * Phones switch between the middle and the lists at the bottom; an open editor takes the screen.
 */
export function Workspace({
  page,
  calendar,
  header,
  main,
  editor = null,
}: {
  page: AppPage;
  calendar: Calendar;
  header: React.ReactNode;
  main: React.ReactNode;
  editor?: React.ReactNode;
}) {
  const { review, queue, timeZone } = calendar;
  const [phoneView, setPhoneView] = useState<"main" | "lists">("main");
  const [list, setList] = useState<List>(review.length > 0 ? "review" : "queue");
  const panelOpen = useItemPanel().mode.kind !== "closed";
  // The phone tab holds both lists.
  const waiting = queue.length + review.length;
  const MainIcon = page === "calendar" ? CalendarDays : ListTodo;
  const mainLabel = page === "calendar" ? "Calendar" : "Tasks";

  return (
    <AppShell
      page={page}
      header={header}
      left={
        <>
          <SegmentedControl
            label="Lists"
            value={list}
            onChange={setList}
            options={[
              {
                value: "review",
                label: counted("To review", review.length),
                content: (
                  <>
                    To review <Count n={review.length} />
                  </>
                ),
              },
              {
                value: "queue",
                label: counted("Queue", queue.length),
                content: (
                  <>
                    Queue <Count n={queue.length} />
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
            <ReviewList entries={review} timeZone={timeZone} />
          </section>
          <section aria-label="Task queue" hidden={list !== "queue"}>
            <TaskQueue entries={queue} timeZone={timeZone} />
          </section>
        </>
      }
      mainLabel={page === "calendar" ? "Calendar" : "Task list"}
      main={main}
      side={editor ?? <ItemPanel />}
      sideOpen={editor !== null || panelOpen}
      phoneSection={editor !== null ? "side" : phoneView === "main" ? "main" : "left"}
      phoneNav={
        <SegmentedControl
          label="View"
          value={phoneView}
          onChange={setPhoneView}
          options={[
            {
              value: "main",
              label: mainLabel,
              content: (
                <>
                  <MainIcon className="size-5" />
                  {mainLabel}
                </>
              ),
            },
            {
              value: "lists",
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
      }
    />
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
