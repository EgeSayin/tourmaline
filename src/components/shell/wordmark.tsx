import { cn } from "@/lib/utils";

export const APP_NAME = "Tourmaline";

/** The app's name set as a logo: a cut gem shading green through blue to pink, as tourmaline crystals do, then the name. Scales with the font size. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[0.35em] font-semibold tracking-tight", className)}>
      <span
        aria-hidden
        className="mx-[0.12em] size-[0.55em] rotate-45 rounded-[0.12em] bg-linear-to-br/longer from-gem-rim to-gem-core shadow-[0_0_0.5em] shadow-gem-core/40"
      />
      <span className="lowercase">{APP_NAME}</span>
    </span>
  );
}
