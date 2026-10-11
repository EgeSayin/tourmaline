import { Plus } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CategoryEntry } from "@/server/categories/category-list";
import { CategoryDot } from "./category-dot";

export function CategoryList({ entries, selectedId }: { entries: CategoryEntry[]; selectedId: string | null }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Categories</h1>
        <Link href="/categories?new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          <Plus />
          New category
        </Link>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map(({ id, name, color, itemCount }) => (
            <li key={id}>
              <Link
                href={`/categories?id=${id}`}
                aria-current={id === selectedId ? "page" : undefined}
                className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm shadow-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:border-ring"
              >
                <CategoryDot color={color} />
                <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
