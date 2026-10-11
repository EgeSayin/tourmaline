import { type Segment, SegmentedControl } from "@/components/controls/segmented-control";
import { buttonVariants } from "@/components/ui/button";
import type { Item } from "@/lib/items";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "flexible", label: "Find time for it" },
  { value: "fixed", label: "At a set time" },
] as const satisfies Segment<Item["timing"]>[];

export function TimingSwitch({
  value,
  onChange,
}: {
  value: Item["timing"];
  onChange: (timing: Item["timing"]) => void;
}) {
  return (
    <>
      <input type="hidden" name="timing" value={value} />
      <SegmentedControl
        label="Timing"
        options={OPTIONS}
        value={value}
        onChange={onChange}
        className="grid grid-cols-2 gap-1 rounded-lg border p-1"
        optionClassName={cn(
          buttonVariants({ variant: "ghost" }),
          "aria-checked:bg-secondary aria-checked:text-secondary-foreground",
        )}
      />
    </>
  );
}
