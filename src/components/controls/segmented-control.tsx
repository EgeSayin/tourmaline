import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Segment<T extends string> {
  value: T;
  /** The option's accessible name, and its text unless `content` is given. */
  label: string;
  content?: React.ReactNode;
}

/**
 * A radio group of buttons, framed ghost buttons of `size` unless `optionClassName` replaces their style.
 * `children` follow the options in the same row.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "sm",
  className,
  optionClassName,
  style,
  children,
}: {
  label: string;
  options: readonly Segment<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  size?: "default" | "sm" | "icon-sm";
  className?: string;
  optionClassName?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(!optionClassName && "gap-1 rounded-lg border bg-card p-1", className)}
      style={style}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.content ? option.label : undefined}
          className={
            optionClassName ??
            cn(
              buttonVariants({ variant: "ghost", size }),
              "text-muted-foreground aria-checked:bg-secondary aria-checked:text-secondary-foreground",
            )
          }
          onClick={() => onChange(option.value)}
        >
          {option.content ?? option.label}
        </button>
      ))}
      {children}
    </div>
  );
}
