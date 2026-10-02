import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatLocalDate } from "@/lib/format";

export function DayNavigator({
  dates,
  selected,
  onSelect,
}: {
  dates: string[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b px-2 py-2 md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Previous day"
        disabled={selected === 0}
        onClick={() => onSelect(selected - 1)}
      >
        <ChevronLeft />
      </Button>
      <span className="text-sm font-semibold">{formatLocalDate(dates[selected])}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Next day"
        disabled={selected === dates.length - 1}
        onClick={() => onSelect(selected + 1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
