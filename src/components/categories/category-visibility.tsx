"use client";

import { createContext, startTransition, use, useOptimistic } from "react";
import { toastNotSaved } from "@/components/forms/action-toasts";
import { ALL_SHOWN, type Category, type CategoryVisibility, isShown } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { saveCategoryVisibilityAction } from "@/server/categories/actions";
import { CategoryDot } from "./category-dot";

const VisibilityContext = createContext<[CategoryVisibility, (next: CategoryVisibility) => void]>([
  ALL_SHOWN,
  () => {},
]);

/** The account's saved category visibility, shown changed at once while a change saves. */
export function CategoryVisibilityProvider({
  saved,
  children,
}: {
  saved: CategoryVisibility;
  children: React.ReactNode;
}) {
  const [visibility, setOptimistic] = useOptimistic(saved);
  const change = (next: CategoryVisibility) =>
    startTransition(async () => {
      setOptimistic(next);
      try {
        await saveCategoryVisibilityAction(next);
      } catch {
        toastNotSaved();
      }
    });
  return <VisibilityContext value={[visibility, change]}>{children}</VisibilityContext>;
}

export function useCategoryVisibility() {
  return use(VisibilityContext);
}

/** A chip per category, and one for items without one, each showing or hiding them; "All" shows everything again. */
export function CategoryChips({ categories }: { categories: Category[] }) {
  const [visibility, change] = useCategoryVisibility();
  if (categories.length === 0) return null;

  const { hiddenIds, uncategorizedHidden } = visibility;
  const toggle = (id: string) =>
    change({
      ...visibility,
      hiddenIds: hiddenIds.includes(id) ? hiddenIds.filter((hidden) => hidden !== id) : [...hiddenIds, id],
    });
  const allShown = categories.every((category) => isShown(category.id, visibility)) && !uncategorizedHidden;

  return (
    <div
      role="group"
      aria-label="Shown categories"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0"
    >
      <Chip pressed={allShown} onClick={() => change(ALL_SHOWN)}>
        All
      </Chip>
      {categories.map(({ id, name, color }) => (
        <Chip key={id} pressed={isShown(id, visibility)} onClick={() => toggle(id)}>
          <CategoryDot color={color} className="size-2.5" />
          {name}
        </Chip>
      ))}
      <Chip
        pressed={!uncategorizedHidden}
        onClick={() => change({ ...visibility, uncategorizedHidden: !uncategorizedHidden })}
      >
        No category
      </Chip>
    </div>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        pressed
          ? "bg-card font-medium text-foreground shadow-xs"
          : "border-dashed text-muted-foreground [&>span]:opacity-30",
      )}
    >
      {children}
    </button>
  );
}
