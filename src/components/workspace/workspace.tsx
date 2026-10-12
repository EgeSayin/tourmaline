"use client";

import { Hourglass } from "lucide-react";
import Link from "next/link";
import { createContext, use, useState } from "react";
import { SegmentedControl } from "@/components/controls/segmented-control";
import { BlockPanel } from "@/components/schedule/block-panel";
import { BlockPanelProvider, useBlockPanel } from "@/components/schedule/block-panel-state";
import { ReviewList } from "@/components/schedule/review-list";
import { TaskQueue } from "@/components/schedule/task-queue";
import { type AppPage, AppShell, NAV_PAGES } from "@/components/shell/app-shell";
import type { Shell } from "@/server/calendar";

type List = "review" | "queue";

const PHONE_TAB =
  "flex flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground aria-[current=page]:text-foreground aria-pressed:text-foreground";

interface ShellState {
  shell: Shell;
  phoneView: "main" | "lists";
  setPhoneView: (view: "main" | "lists") => void;
  list: List;
  setList: (list: List) => void;
}

const ShellContext = createContext<ShellState | null>(null);

/** Holds `shell` and what the shell around every page shows, so it stays as it is when the page changes. */
export function WorkspaceProvider({ shell, children }: { shell: Shell; children: React.ReactNode }) {
  const [phoneView, setPhoneView] = useState<"main" | "lists">("main");
  const [list, setList] = useState<List>(shell.review.length > 0 ? "review" : "queue");
  return (
    <BlockPanelProvider timeZone={shell.timeZone}>
      <ShellContext value={{ shell, phoneView, setPhoneView, list, setList }}>
        <main>{children}</main>
      </ShellContext>
    </BlockPanelProvider>
  );
}

/** Lists on the left (opening on review while it has any), the page in the middle, and `editor` or the block panel on the right. */
export function Workspace({
  page,
  main,
  editor = null,
}: {
  page: AppPage;
  /** The page's own header first, then its content. */
  main: React.ReactNode;
  editor?: React.ReactNode;
}) {
  const { shell, phoneView, setPhoneView, list, setList } = use(ShellContext)!;
  const { review, queue, timeZone } = shell;
  const panelOpen = useBlockPanel().block !== null;
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
          {NAV_PAGES.map(({ page: target, href, label, Icon }) => (
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

function counted(name: string, count: number) {
  return count > 0 ? `${name} (${count})` : name;
}

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
