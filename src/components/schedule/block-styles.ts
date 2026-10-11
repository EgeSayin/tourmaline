import type { BlockStyle } from "@/lib/calendar-blocks";
import type { CategoryColor } from "@/lib/categories";

/** The fill of a block without a category. */
export const BLOCK_FILL = "bg-muted text-foreground";

/** A block's fill comes from its category; the outline shows its kind and state. */
export const CATEGORY_FILLS: Record<CategoryColor, string> = {
  slate: "bg-slate-200 text-slate-950 dark:bg-slate-700/70 dark:text-slate-50",
  red: "bg-red-100 text-red-950 dark:bg-red-900/50 dark:text-red-50",
  orange: "bg-orange-100 text-orange-950 dark:bg-orange-900/50 dark:text-orange-50",
  yellow: "bg-yellow-100 text-yellow-950 dark:bg-yellow-900/50 dark:text-yellow-50",
  green: "bg-green-100 text-green-950 dark:bg-green-900/50 dark:text-green-50",
  teal: "bg-teal-100 text-teal-950 dark:bg-teal-900/50 dark:text-teal-50",
  blue: "bg-blue-100 text-blue-950 dark:bg-blue-900/50 dark:text-blue-50",
  indigo: "bg-indigo-100 text-indigo-950 dark:bg-indigo-900/50 dark:text-indigo-50",
  purple: "bg-purple-100 text-purple-950 dark:bg-purple-900/50 dark:text-purple-50",
  pink: "bg-pink-100 text-pink-950 dark:bg-pink-900/50 dark:text-pink-50",
};

export function blockFill(color: CategoryColor | null): string {
  return color ? CATEGORY_FILLS[color] : BLOCK_FILL;
}

/** Drawn around a block's outline when it's a fixed item overlapping another. */
export const CONFLICT_STYLE = { label: "Conflict", className: "ring-2 ring-red-500 dark:ring-red-400" };

/** The outline, and any text style, for each kind and state. */
export const BLOCK_STYLES: Record<BlockStyle, { label: string; className: string }> = {
  fixed: { label: "Fixed", className: "border-2 border-sky-500 dark:border-sky-400" },
  "fixed-optional": {
    label: "Fixed, optional",
    className: "border-2 border-dashed border-sky-500 dark:border-sky-400",
  },
  scheduled: { label: "Scheduled", className: "border-2 border-violet-500 dark:border-violet-400" },
  "to-review": { label: "To review", className: "border-2 border-amber-500 dark:border-amber-400" },
  done: { label: "Done", className: "border-2 border-emerald-500 dark:border-emerald-400" },
  missed: {
    label: "Missed",
    className: "border-2 border-dashed border-rose-500 line-through dark:border-rose-400",
  },
};
