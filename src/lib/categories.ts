/** The colours a category can have; each names a palette its blocks are filled from. */
export const CATEGORY_COLORS = [
  "slate",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "indigo",
  "purple",
  "pink",
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

/** What items are grouped by, e.g. a course; for now it only colours their blocks. */
export interface Category {
  id: string;
  /** Unique among categories. */
  name: string;
  color: CategoryColor;
}

export type NewCategory = Omit<Category, "id">;

export const CATEGORY_NAME_MAX = 40;

/** Shows every item, those without a category (`NO_CATEGORY`), or one category's, by its id. */
export type CategoryFilter = typeof ALL_CATEGORIES | typeof NO_CATEGORY | (string & {});

export const ALL_CATEGORIES = "all";
export const NO_CATEGORY = "none";

export function matchesFilter(categoryId: string | null, filter: CategoryFilter): boolean {
  if (filter === ALL_CATEGORIES) return true;
  return filter === NO_CATEGORY ? categoryId === null : categoryId === filter;
}
