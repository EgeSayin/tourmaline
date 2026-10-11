import { CalendarDays, ListTodo, Plus } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AppPage = "calendar" | "tasks";

/** The one section shown on phones, where the columns don't fit side by side. */
export type PhoneSection = "left" | "main" | "side";

/**
 * Tablet and up: three columns (left, main, side), each a header over a section; the left header is empty. The
 * middle header starts with the switch between pages, which change only the middle; the right one holds the theme
 * toggle and Add item. The main section spans the side column while `sideOpen` is
 * false. `side` places itself, as a column or, on phones, wherever it likes.
 * Phones: the headers stack on top, only `phoneSection` is shown, and `phoneNav` is a bar at the bottom.
 */
export function AppShell({
  page,
  header,
  left,
  main,
  mainLabel,
  side,
  sideOpen,
  phoneSection,
  phoneNav,
}: {
  page: AppPage;
  header: React.ReactNode;
  left: React.ReactNode;
  main: React.ReactNode;
  mainLabel: string;
  side: React.ReactNode;
  sideOpen: boolean;
  phoneSection: PhoneSection;
  phoneNav?: React.ReactNode;
}) {
  const shownOn = (section: PhoneSection) => (section === phoneSection ? "" : "hidden md:block");

  return (
    <div
      className={cn(
        "grid md:h-dvh md:grid-cols-[13rem_minmax(0,1fr)_20rem] md:grid-rows-[auto_minmax(0,1fr)] md:pb-0 lg:grid-cols-[16rem_minmax(0,1fr)_24rem]",
        phoneNav && "pb-20",
      )}
    >
      <header className="hidden min-h-16 border-r border-b md:block" />
      <header className="flex min-h-16 flex-wrap items-center gap-x-4 border-b px-4">
        <AppNav page={page} className="hidden md:inline-flex" />
        {header}
      </header>
      <header className="flex min-h-16 items-center justify-between gap-2 border-b px-4 md:justify-end md:border-l">
        <AppNav page={page} compact className="md:hidden" />
        <ThemeToggle />
        <AddItemLink />
      </header>

      <div className={`space-y-4 overflow-y-auto p-4 md:border-r ${shownOn("left")}`}>{left}</div>
      <section
        aria-label={mainLabel}
        className={`space-y-3 overflow-y-auto p-4 ${sideOpen ? "" : "md:col-span-2"} ${shownOn("main")}`}
      >
        {main}
      </section>
      {side}
      {phoneNav}
    </div>
  );
}

const PAGES = [
  { page: "calendar", href: "/", label: "Calendar", Icon: CalendarDays },
  { page: "tasks", href: "/tasks", label: "Tasks", Icon: ListTodo },
] as const;

/** Links between the pages, the current one marked; `compact` shows only their icons. */
function AppNav({ page, compact = false, className = "" }: { page: AppPage; compact?: boolean; className?: string }) {
  return (
    <nav aria-label="Pages" className={cn("inline-flex gap-0.5 rounded-lg border bg-card p-0.5", className)}>
      {PAGES.map(({ page: target, href, label, Icon }) => (
        <Link
          key={target}
          href={href}
          aria-current={target === page ? "page" : undefined}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-muted-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground",
          )}
        >
          <Icon />
          <span className={compact ? "sr-only" : undefined}>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Opens the form for a new item on the tasks page, from any page. */
function AddItemLink() {
  return (
    <Link href="/tasks?new" className={buttonVariants()}>
      <Plus />
      Add item
    </Link>
  );
}
