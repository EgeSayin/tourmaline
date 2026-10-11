import type { CategoryColor } from "@/lib/categories";
import { cn } from "@/lib/utils";

const DOT_COLORS: Record<CategoryColor, string> = {
  slate: "bg-slate-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-400",
  green: "bg-green-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};

export function CategoryDot({ color, className }: { color: CategoryColor; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-3 shrink-0 rounded-full", DOT_COLORS[color], className)} />;
}
