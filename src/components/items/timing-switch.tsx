import { Button } from "@/components/ui/button";
import type { Item } from "@/lib/items";

const OPTIONS = [
  { value: "flexible", label: "Find time for it" },
  { value: "fixed", label: "At a set time" },
] as const satisfies { value: Item["timing"]; label: string }[];

export function TimingSwitch({
  value,
  onChange,
}: {
  value: Item["timing"];
  onChange: (timing: Item["timing"]) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Timing" className="grid grid-cols-2 gap-1 rounded-lg border p-1">
      <input type="hidden" name="timing" value={value} />
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          variant={value === option.value ? "secondary" : "ghost"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
