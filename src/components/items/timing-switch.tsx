import { type Segment, SegmentedControl } from "@/components/controls/segmented-control";
import type { Item } from "@/lib/items";

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
        size="default"
        className="grid grid-cols-2"
      />
    </>
  );
}
