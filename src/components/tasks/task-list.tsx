"use client";

import { Repeat } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CategoryFilterSelect, useCategoryFilter } from "@/components/categories/category-filter";
import { SegmentedControl } from "@/components/controls/segmented-control";
import { type Category, matchesFilter } from "@/lib/categories";
import { formatDateTime } from "@/lib/time/format";
import type { TimeZone } from "@/lib/time/time-zone";
import { cn } from "@/lib/utils";
import type { ItemEntry, ItemStatus } from "@/server/tasks";

type Filter = "open" | "done" | "all";

const SHOWN: Record<Filter, (status: ItemStatus) => boolean> = {
  open: (status) => status === "scheduled" || status === "queued",
  done: (status) => status === "done",
  all: () => true,
};

const STATUS_LABELS = {
  scheduled: "Scheduled",
  queued: "Doesn't fit",
  done: "Done",
  past: "Past",
} satisfies Record<ItemStatus, string>;

const STATUS_STYLES = {
  scheduled: "text-muted-foreground",
  queued: "bg-state-review-soft text-state-review-ink",
  done: "bg-state-done-soft text-state-done-ink",
  past: "text-muted-foreground",
} satisfies Record<ItemStatus, string>;

export function TaskList({
  entries,
  categories,
  selectedId,
  timeZone,
}: {
  entries: ItemEntry[];
  categories: Category[];
  selectedId: string | null;
  timeZone: TimeZone;
}) {
  const [filter, setFilter] = useState<Filter>("open");
  const [category] = useCategoryFilter();
  const shown = entries.filter(
    (entry) => SHOWN[filter](entry.status) && matchesFilter(entry.target.item.categoryId, category),
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: "Open" },
            { value: "done", label: "Done" },
            { value: "all", label: "All" },
          ]}
          className="inline-grid grid-cols-3"
        />
        <CategoryFilterSelect categories={categories} />
      </div>
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((entry) => (
            <li key={entry.id}>
              <TaskRow entry={entry} current={entry.id === selectedId} timeZone={timeZone} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TaskRow({ entry, current, timeZone }: { entry: ItemEntry; current: boolean; timeZone: TimeZone }) {
  const { id, title, kind, recurring, when, status } = entry;
  return (
    <Link
      href={`/tasks?id=${id}`}
      aria-current={current ? "page" : undefined}
      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm shadow-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:border-ring"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{title}</span>
          {recurring && <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-label="Repeats" />}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {kind === "task" ? "Task · due" : "Event ·"} {formatDateTime(when, timeZone)}
        </span>
      </span>
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", STATUS_STYLES[status])}>
        {STATUS_LABELS[status]}
      </span>
    </Link>
  );
}
