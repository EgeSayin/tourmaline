import type { BlockStyle } from "@/lib/calendar-blocks";

/** A block's fill, the same for every kind and state; the outline tells them apart. */
export const BLOCK_FILL = "bg-slate-100 text-slate-950 dark:bg-slate-800/70 dark:text-slate-50";

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
