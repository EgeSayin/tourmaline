import { cn } from "@/lib/utils";

export const APP_NAME = "Tourmaline";

/** The app's name set as a logo: a slice of watermelon tourmaline (pink core, green rim), then the name. Scales with the font size. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[0.4em] font-display font-semibold tracking-tight [font-variation-settings:'SOFT'_100]",
        className,
      )}
    >
      <span aria-hidden className="mx-[0.1em] size-[0.55em] rotate-45 rounded-[0.1em] bg-gem-rim p-[0.1em]">
        <span className="block size-full rounded-[0.05em] bg-gem-core" />
      </span>
      <span className="lowercase">{APP_NAME}</span>
    </span>
  );
}
