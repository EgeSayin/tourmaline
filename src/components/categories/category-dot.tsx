import type { CategoryColor } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function CategoryDot({ color, className }: { color: CategoryColor; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}
