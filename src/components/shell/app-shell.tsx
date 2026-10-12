import { CalendarDays, ListTodo, Plus, Settings, Tags } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "@/components/shell/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AppPage = (typeof PAGES)[number]["page"] | "settings";

export type PhoneSection = "left" | "main" | "side";

/** Three columns (left, main, side) under their headers; the page switch changes only `main`. Phones show one section at a time, picked by `phoneSection`, with `phoneNav` at the bottom. */
export function AppShell({
  page,
  left,
  main,
  side,
  sideOpen,
  phoneSection,
  phoneNav,
}: {
  page: AppPage;
  left: React.ReactNode;
  main: React.ReactNode;
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
      <header className="hidden min-h-16 items-center border-r border-b px-4 md:flex">
        <Link href="/" className="rounded-md text-lg outline-offset-4">
          <Wordmark />
        </Link>
      </header>
      <header className="hidden min-h-16 items-center border-b px-4 md:flex">
        <AppNav page={page} />
      </header>
      <header className="flex min-h-16 items-center justify-between gap-2 border-b px-4 md:justify-end md:border-l">
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <SettingsLink current={page === "settings"} />
        </div>
        <AddItemLink />
      </header>

      <div className={`space-y-4 overflow-y-auto p-4 md:border-r ${shownOn("left")}`}>{left}</div>
      <section
        aria-label={page === "settings" ? "Settings" : PAGES.find((entry) => entry.page === page)!.region}
        className={`space-y-3 overflow-y-auto p-4 ${sideOpen ? "" : "md:col-span-2"} ${shownOn("main")}`}
      >
        {main}
      </section>
      {side}
      {phoneNav}
    </div>
  );
}

/** `region` names the page's main section. */
export const PAGES = [
  { page: "calendar", href: "/", label: "Calendar", region: "Calendar", Icon: CalendarDays },
  { page: "tasks", href: "/tasks", label: "Tasks", region: "Task list", Icon: ListTodo },
  { page: "categories", href: "/categories", label: "Categories", region: "Category list", Icon: Tags },
] as const;

function AppNav({ page }: { page: AppPage }) {
  return (
    <nav aria-label="Pages" className="inline-flex gap-0.5 rounded-lg border bg-card p-0.5">
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
          {label}
        </Link>
      ))}
    </nav>
  );
}

function SettingsLink({ current }: { current: boolean }) {
  return (
    <Link
      href="/settings"
      aria-label="Settings"
      aria-current={current ? "page" : undefined}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "aria-[current=page]:bg-muted")}
    >
      <Settings />
    </Link>
  );
}

function AddItemLink() {
  return (
    <Link href="/tasks?new" className={buttonVariants()}>
      <Plus />
      Add item
    </Link>
  );
}
