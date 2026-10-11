import { FormSection } from "@/components/forms/form-fields";
import { BlockSummary } from "@/components/items/block-summary";
import { PlacementActions } from "@/components/items/placement-actions";
import type { TimeZone } from "@/lib/time/time-zone";
import type { TaskBlock } from "@/server/tasks";

/** Every block of a task, past and planned, each with what can be done with it. */
export function TaskBlocks({ blocks, timeZone }: { blocks: TaskBlock[]; timeZone: TimeZone }) {
  return (
    <FormSection title="Blocks">
      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not scheduled yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {blocks.map((block) => (
            <li key={block.start.toISOString()} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <BlockSummary block={block} timeZone={timeZone} />
              <PlacementActions placement={block.placement} />
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  );
}
