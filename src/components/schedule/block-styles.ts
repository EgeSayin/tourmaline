import type { BlockStyle } from "@/lib/calendar-blocks";

export const BLOCK_STYLES: Record<BlockStyle, { label: string; className: string }> = {
  fixed: {
    label: "Fixed",
    className: "border border-sky-200 bg-sky-100 text-sky-950 dark:border-sky-800 dark:bg-sky-900/60 dark:text-sky-50",
  },
  "fixed-optional": {
    label: "Fixed, optional",
    className:
      "border border-dashed border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-100",
  },
  scheduled: {
    label: "Scheduled",
    className:
      "border-l-[3px] border-violet-500 bg-violet-50 text-violet-950 dark:bg-violet-950/50 dark:text-violet-100",
  },
  "to-review": {
    label: "To review",
    className: "border-l-[3px] border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100",
  },
  done: {
    label: "Done",
    className:
      "border-l-[3px] border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
  missed: {
    label: "Missed",
    className:
      "border border-dashed border-rose-300 bg-rose-50/60 text-rose-900 line-through dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200",
  },
};
