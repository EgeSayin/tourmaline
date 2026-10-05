"use client";

import { CalendarDays, Hourglass } from "lucide-react";
import { useState } from "react";
import { AddItemButton, ItemPanel } from "@/components/items/item-panel";
import { useItemPanel } from "@/components/items/item-panel-state";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ScheduleLegend } from "./schedule-legend";

type View = "calendar" | "queue";

/**
 * Tablet and up: three columns (queue, calendar, tools), each a header over a section; the queue header is empty.
 * The tools section holds the add/edit panel; while it's closed, the calendar section takes its place.
 * Phones: the headers stack on top and a bottom tab bar switches between the calendar and the queue.
 */
export function ScheduleView({
  calendarHeader,
  calendar,
  queue,
  queueCount,
}: {
  calendarHeader: React.ReactNode;
  calendar: React.ReactNode;
  queue: React.ReactNode;
  queueCount: number;
}) {
  const [view, setView] = useState<View>("calendar");
  const panelOpen = useItemPanel().mode.kind !== "closed";
  const shownOn = (target: View) => (view === target ? "" : "hidden md:block");

  return (
    <div className="grid pb-20 md:h-dvh md:grid-cols-[13rem_minmax(0,1fr)_20rem] md:grid-rows-[auto_minmax(0,1fr)] md:pb-0 lg:grid-cols-[16rem_minmax(0,1fr)_24rem]">
      <header className="hidden min-h-16 border-r border-b md:block" />
      <header className="flex min-h-16 items-center border-b px-4">{calendarHeader}</header>
      <header className="flex min-h-16 items-center justify-between gap-2 border-b px-4 md:justify-end md:border-l">
        <ThemeToggle />
        <AddItemButton />
      </header>

      <section aria-label="Task queue" className={`overflow-y-auto p-4 md:border-r ${shownOn("queue")}`}>
        <h2 className="mb-3 flex items-baseline justify-between text-sm font-semibold">
          Queue
          <span className="text-xs font-normal text-muted-foreground tabular-nums">{queueCount}</span>
        </h2>
        {queue}
      </section>
      <section
        aria-label="Calendar"
        className={`space-y-3 overflow-y-auto p-4 ${panelOpen ? "" : "md:col-span-2"} ${shownOn("calendar")}`}
      >
        <ScheduleLegend />
        {calendar}
      </section>
      <ItemPanel />

      <nav
        aria-label="View"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <TabButton active={view === "calendar"} onClick={() => setView("calendar")}>
          <CalendarDays className="size-5" />
          Calendar
        </TabButton>
        <TabButton active={view === "queue"} onClick={() => setView("queue")}>
          <span className="relative">
            <Hourglass className="size-5" />
            {queueCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] leading-4 font-semibold text-white tabular-nums">
                {queueCount}
              </span>
            )}
          </span>
          Queue
        </TabButton>
      </nav>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-2 text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}
    >
      {children}
    </button>
  );
}
