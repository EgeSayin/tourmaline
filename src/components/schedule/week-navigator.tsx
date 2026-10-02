import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { WeekNavigation } from "@/server/week";

export function WeekNavigator({ navigation }: { navigation: WeekNavigation }) {
  return (
    <nav className="flex items-center gap-1" aria-label="Weeks">
      <Link
        href={`/?week=${navigation.previous}`}
        aria-label="Previous week"
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronLeft />
      </Link>
      <Link
        href="/"
        aria-disabled={navigation.weeksFromToday === 0}
        className={`${buttonVariants({ variant: "outline" })} aria-disabled:pointer-events-none aria-disabled:opacity-50`}
      >
        Today
      </Link>
      <Link
        href={`/?week=${navigation.next}`}
        aria-label="Next week"
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronRight />
      </Link>
    </nav>
  );
}
