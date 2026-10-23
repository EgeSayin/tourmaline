/** A colour as lowercase `#rrggbb`. */
export type CategoryColor = string;

export const CATEGORY_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

/** The quick picks in the editor; any other colour is picked as a custom one. */
export const CATEGORY_PRESETS = {
  Slate: "#64748b",
  Red: "#ef4444",
  Orange: "#f97316",
  Yellow: "#facc15",
  Green: "#22c55e",
  Teal: "#14b8a6",
  Blue: "#3b82f6",
  Indigo: "#6366f1",
  Purple: "#a855f7",
  Pink: "#ec4899",
} satisfies Record<string, CategoryColor>;

export const NEW_CATEGORY_COLOR: CategoryColor = CATEGORY_PRESETS.Blue;

export interface Category {
  id: string;
  /** Unique among categories. */
  name: string;
  color: CategoryColor;
}

export type NewCategory = Omit<Category, "id">;

export const CATEGORY_NAME_MAX = 40;

export type CategoryFilter = typeof ALL_CATEGORIES | typeof NO_CATEGORY | (string & {});

export const ALL_CATEGORIES = "all";
export const NO_CATEGORY = "none";

export function matchesFilter(categoryId: string | null, filter: CategoryFilter): boolean {
  if (filter === ALL_CATEGORIES) return true;
  return filter === NO_CATEGORY ? categoryId === null : categoryId === filter;
}
