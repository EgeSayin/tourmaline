import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-3 px-4 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">There&apos;s nothing at this address.</p>
      <Link href="/" className={buttonVariants()}>
        Go to the calendar
      </Link>
    </div>
  );
}
