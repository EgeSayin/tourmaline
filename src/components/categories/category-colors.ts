import type { CategoryColor } from "@/lib/categories";

/** Each category colour as a block's fill and as a dot, so a restyle changes them together. */
export const CATEGORY_COLOR_CLASSES: Record<CategoryColor, { fill: string; dot: string }> = {
  slate: { fill: "bg-slate-200 text-slate-950 dark:bg-slate-700/70 dark:text-slate-50", dot: "bg-slate-500" },
  red: { fill: "bg-red-100 text-red-950 dark:bg-red-900/50 dark:text-red-50", dot: "bg-red-500" },
  orange: { fill: "bg-orange-100 text-orange-950 dark:bg-orange-900/50 dark:text-orange-50", dot: "bg-orange-500" },
  yellow: { fill: "bg-yellow-100 text-yellow-950 dark:bg-yellow-900/50 dark:text-yellow-50", dot: "bg-yellow-400" },
  green: { fill: "bg-green-100 text-green-950 dark:bg-green-900/50 dark:text-green-50", dot: "bg-green-500" },
  teal: { fill: "bg-teal-100 text-teal-950 dark:bg-teal-900/50 dark:text-teal-50", dot: "bg-teal-500" },
  blue: { fill: "bg-blue-100 text-blue-950 dark:bg-blue-900/50 dark:text-blue-50", dot: "bg-blue-500" },
  indigo: { fill: "bg-indigo-100 text-indigo-950 dark:bg-indigo-900/50 dark:text-indigo-50", dot: "bg-indigo-500" },
  purple: { fill: "bg-purple-100 text-purple-950 dark:bg-purple-900/50 dark:text-purple-50", dot: "bg-purple-500" },
  pink: { fill: "bg-pink-100 text-pink-950 dark:bg-pink-900/50 dark:text-pink-50", dot: "bg-pink-500" },
};
