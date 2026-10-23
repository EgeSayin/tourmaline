"use client";

import { useState } from "react";
import { type Segment, SegmentedControl } from "@/components/controls/segmented-control";
import { FormSection } from "@/components/forms/form-fields";
import type { EditTarget } from "@/lib/calendar-blocks";
import type { Category } from "@/lib/categories";
import { isFixed } from "@/lib/items";
import type { TimeZone } from "@/lib/time/time-zone";
import { OccurrenceForm } from "./occurrence-form";
import { QuickItemForm } from "./quick-item-form";

type Scope = "one" | "later";

const SCOPE_OPTIONS = [
  { value: "one", label: "Only this one" },
  { value: "later", label: "This and later ones" },
] satisfies Segment<Scope>[];

/** Edits a block's item, or its occurrence alone or the series from it on; not the block itself. */
export function BlockEditor({
  target,
  categories,
  timeZone,
  onDone,
}: {
  target: EditTarget;
  categories: Category[];
  timeZone: TimeZone;
  onDone: () => void;
}) {
  const [scope, setScope] = useState<Scope>("one");
  const { occurrence } = target;

  return (
    <FormSection title={isFixed(target.item) ? "Event" : "Task"}>
      {occurrence && (
        <SegmentedControl
          label="Edit"
          value={scope}
          onChange={setScope}
          options={SCOPE_OPTIONS}
          className="flex self-start"
        />
      )}
      {occurrence && scope === "one" ? (
        <OccurrenceForm key={occurrence.date} occurrence={occurrence} timeZone={timeZone} onDone={onDone} />
      ) : (
        <QuickItemForm
          key={scope}
          item={occurrence?.series ?? target.item}
          categories={categories}
          timeZone={timeZone}
          onDone={onDone}
        />
      )}
    </FormSection>
  );
}
