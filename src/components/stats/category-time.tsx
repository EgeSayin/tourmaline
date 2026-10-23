import { CategoryDot } from "@/components/categories/category-dot";
import { formatDuration } from "@/lib/time/format";
import type { CategoryTime as Entry } from "@/server/stats";

/** Done task time per category as bars in the category's colour, scaled to the largest. */
export function CategoryTime({ entries }: { entries: Entry[] }) {
  const most = Math.max(...entries.map((entry) => entry.doneMin), 1);
  return (
    <ol className="flex flex-col gap-2.5">
      {entries.map(({ category, doneMin }) => (
        <li
          key={category?.id ?? "none"}
          className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center sm:gap-3"
        >
          <span className="flex min-w-0 items-center gap-1.5 text-sm">
            {category && <CategoryDot color={category.color} />}
            <span className="truncate">{category?.name ?? "No category"}</span>
          </span>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-3 rounded-sm bg-muted-foreground/40"
              style={{ width: `${(doneMin / most) * 100}%`, ...(category && { backgroundColor: category.color }) }}
            />
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatDuration(doneMin)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
