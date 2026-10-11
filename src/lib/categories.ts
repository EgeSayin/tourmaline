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
