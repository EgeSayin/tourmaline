import type { CategoryColor } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { CATEGORY_COLOR_CLASSES } from "./category-colors";

export function CategoryDot({ color, className }: { color: CategoryColor; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3 shrink-0 rounded-full", CATEGORY_COLOR_CLASSES[color].dot, className)}
    />
  );
}
