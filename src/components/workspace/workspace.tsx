"use client";

import { Hourglass } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SegmentedControl } from "@/components/controls/segmented-control";
import { BlockPanel } from "@/components/schedule/block-panel";
import { BlockPanelProvider, useBlockPanel } from "@/components/schedule/block-panel-state";
import { ReviewList } from "@/components/schedule/review-list";
import { TaskQueue } from "@/components/schedule/task-queue";
import { type AppPage, AppShell, PAGES } from "@/components/shell/app-shell";
import type { Calendar } from "@/server/calendar";

type List = "review" | "queue";

const PHONE_TAB =
  "flex flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground aria-[current=page]:text-foreground aria-pressed:text-foreground";

/**
 * What every page shows around its middle: the lists on the left (blocks to review and the queue, opening on the
 * review while it has any) and, on the right, `editor` when given, or else the panel for the block clicked.
 * Phones switch pages and the lists at the bottom; an open editor takes the screen until the lists are shown.
 */
export function Workspace(props: WorkspaceProps) {
  return (
    <BlockPanelProvider timeZone={props.calendar.timeZone}>
      <main>
        <WorkspaceShell {...props} />
      </main>
    </BlockPanelProvider>
  );
}

interface WorkspaceProps {
  page: AppPage;
  calendar: Calendar;
  /** The page's own header first, then its content. */
  main: React.ReactNode;
  editor?: React.ReactNode;
}

function WorkspaceShell({ page, calendar, main, editor = null }: WorkspaceProps) {
  const { review, queue, timeZone } = calendar;
  const [phoneView, setPhoneView] = useState<"main" | "lists">("main");
  const [list, setList] = useState<List>(review.length > 0 ? "review" : "queue");
  const panelOpen = useBlockPanel().block !== null;
  // The phone tab holds both lists.
  const waiting = queue.length + review.length;

  return (
    <AppShell
      page={page}
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
            className="grid grid-cols-2"
          />
          <section aria-label="To review" hidden={list !== "review"}>
            <ReviewList entries={review} timeZone={timeZone} />
          </section>
          <section aria-label="Task queue" hidden={list !== "queue"}>
            <TaskQueue entries={queue} timeZone={timeZone} />
          </section>
        </>
      }
      main={main}
      side={editor ?? <BlockPanel />}
      sideOpen={editor !== null || panelOpen}
      phoneSection={phoneView === "lists" ? "left" : editor !== null ? "side" : "main"}
      phoneNav={
        <nav
          aria-label="Views"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          {PAGES.map(({ page: target, href, label, Icon }) => (
            <Link
              key={target}
              href={href}
              aria-current={target === page && phoneView === "main" ? "page" : undefined}
              // On its own page, the tab only leaves the lists; with an editor open, it closes it too.
              onClick={(event) => {
                if (target === page && editor === null) event.preventDefault();
                setPhoneView("main");
              }}
              className={PHONE_TAB}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
          <button
            type="button"
            aria-label={counted("Queue", waiting)}
            aria-pressed={phoneView === "lists"}
            onClick={() => setPhoneView("lists")}
            className={PHONE_TAB}
          >
            <span className="relative">
              <Hourglass className="size-5" />
              <Count n={waiting} className="absolute -top-1.5 -right-2.5" />
            </span>
            Queue
          </button>
        </nav>
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
