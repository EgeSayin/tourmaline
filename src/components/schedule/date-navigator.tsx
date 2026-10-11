import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Previous, Today and Next links stepping by `unit`; links are `?date=` local dates. */
export function DateNavigator({
  unit,
  previous,
  next,
  atToday,
  className = "",
}: {
  unit: "week" | "days";
  previous: string;
  next: string;
  atToday: boolean;
  className?: string;
}) {
  return (
    <nav className={`items-center gap-1 ${className}`} aria-label={unit === "week" ? "Weeks" : "Days"}>
      <Link
        href={`/?date=${previous}`}
        aria-label={`Previous ${unit}`}
        className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
      >
        <ChevronLeft />
      </Link>
      <Link
        href="/"
        aria-disabled={atToday}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "aria-disabled:pointer-events-none aria-disabled:opacity-50",
        )}
      >
        Today
      </Link>
      <Link
        href={`/?date=${next}`}
        aria-label={`Next ${unit}`}
        className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
      >
        <ChevronRight />
      </Link>
    </nav>
  );
}
