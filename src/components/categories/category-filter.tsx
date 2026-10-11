"use client";

import { createContext, use, useEffect, useState } from "react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ALL_CATEGORIES, type Category, type CategoryFilter, NO_CATEGORY } from "@/lib/categories";
import { CategoryDot } from "./category-dot";

const FilterContext = createContext<[CategoryFilter, (filter: CategoryFilter) => void]>([ALL_CATEGORIES, () => {}]);

/** Which categories every page shows; it lasts across pages, since the root layout stays mounted. */
export function CategoryFilterProvider({ children }: { children: React.ReactNode }) {
  const state = useState<CategoryFilter>(ALL_CATEGORIES);
  return <FilterContext value={state}>{children}</FilterContext>;
}

export function useCategoryFilter() {
  return use(FilterContext);
}

/** Picks the filter among `categories`; a filter on a category that's gone goes back to showing everything. */
export function CategoryFilterSelect({ categories }: { categories: Category[] }) {
  const [filter, setFilter] = useCategoryFilter();
  const picked = categories.find((category) => category.id === filter);
  const gone = filter !== ALL_CATEGORIES && filter !== NO_CATEGORY && !picked;
  useEffect(() => {
    if (gone) setFilter(ALL_CATEGORIES);
  }, [gone, setFilter]);

  return (
    <div className="flex items-center gap-2">
      {picked && <CategoryDot color={picked.color} />}
      <NativeSelect
        size="sm"
        aria-label="Category filter"
        value={gone ? ALL_CATEGORIES : filter}
        onChange={(event) => setFilter(event.target.value)}
      >
        <NativeSelectOption value={ALL_CATEGORIES}>All categories</NativeSelectOption>
        <NativeSelectOption value={NO_CATEGORY}>No category</NativeSelectOption>
        {categories.map(({ id, name }) => (
          <NativeSelectOption key={id} value={id}>
            {name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
