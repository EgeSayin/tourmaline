import type { BlockStyle } from "@/lib/calendar-blocks";
import type { CategoryColor } from "@/lib/categories";

export const BLOCK_FILL = "bg-muted text-foreground";

/**
 * Any colour tinted towards a neutral base rather than the themed background, so the text stays readable in both
 * themes and the theme never shifts a category's colour.
 */
const CATEGORY_FILL =
  "bg-[color-mix(in_oklch,var(--category)_25%,var(--category-base))] text-foreground dark:bg-[color-mix(in_oklch,var(--category)_40%,var(--category-base))]";

/** A block's fill comes from its category; the outline shows its kind and state. */
export function blockFill(color: CategoryColor | null): { className: string; style?: React.CSSProperties } {
  return color
    ? { className: CATEGORY_FILL, style: { "--category": color } as React.CSSProperties }
    : { className: BLOCK_FILL };
}

/** A fixed item's buffer: its fill striped with the page background, slightly faded, without an outline. */
export const BUFFER_STYLE = {
  label: "Buffer",
  className: "opacity-90",
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
  done: { label: "Done", className: "border-2 border-state-done opacity-60 line-through" },
  missed: {
    label: "Missed",
    className: "border-2 border-dashed border-state-missed line-through",
  },
};
