import type { BlockStyle } from "@/lib/calendar-blocks";
import { CATEGORY_COLOR_CLASSES } from "@/components/categories/category-colors";
import type { CategoryColor } from "@/lib/categories";

export const BLOCK_FILL = "bg-muted text-foreground";

/** A block's fill comes from its category; the outline shows its kind and state. */
export function blockFill(color: CategoryColor | null): string {
  return color ? CATEGORY_COLOR_CLASSES[color].fill : BLOCK_FILL;
}

/** A fixed item's buffer: its fill striped with the page background, faded, without an outline. */
export const BUFFER_STYLE = {
  label: "Buffer",
  className: "opacity-60",
  style: {
    backgroundImage: "repeating-linear-gradient(135deg, transparent 0 3px, var(--background) 3px 6px)",
  } satisfies React.CSSProperties,
};

export const CONFLICT_STYLE = { label: "Conflict", className: "ring-2 ring-conflict" };

export const BLOCK_STYLES: Record<BlockStyle, { label: string; className: string }> = {
  fixed: { label: "Fixed", className: "border-2 border-state-fixed" },
  "fixed-optional": {
    label: "Fixed, optional",
    className: "border-2 border-dashed border-state-fixed",
  },
  displaced: {
    label: "Displaced",
    className: "border-2 border-dashed border-state-fixed opacity-50",
  },
  scheduled: { label: "Scheduled", className: "border-2 border-state-scheduled" },
  "to-review": { label: "To review", className: "border-2 border-state-review" },
  done: { label: "Done", className: "border-2 border-state-done" },
  missed: {
    label: "Missed",
    className: "border-2 border-dashed border-state-missed line-through",
  },
};
