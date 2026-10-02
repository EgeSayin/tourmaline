"use client";

import { CalendarDays, Hourglass } from "lucide-react";
import { useState } from "react";

type View = "calendar" | "queue";

/** The queue beside the calendar on large screens; on smaller ones, a bottom tab bar switches between them. */
export function ScheduleView({
  queue,
  queueCount,
  calendar,
}: {
  queue: React.ReactNode;
  queueCount: number;
  calendar: React.ReactNode;
}) {
  const [view, setView] = useState<View>("calendar");
  const shownOn = (target: View) => (view === target ? "" : "hidden lg:block");

  return (
    <div className="flex items-start gap-4 pb-20 lg:pb-0">
      <aside className={`w-full lg:sticky lg:top-4 lg:w-60 lg:shrink-0 ${shownOn("queue")}`}>{queue}</aside>
      <div className={`min-w-0 flex-1 ${shownOn("calendar")}`}>{calendar}</div>

      <nav
        aria-label="View"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
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
