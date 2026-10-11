export interface Segment<T extends string> {
  value: T;
  /** The option's accessible name, and its text unless `content` is given. */
  label: string;
  content?: React.ReactNode;
}

/**
 * Buttons picking exactly one of `options`, as a radio group. Style the picked one with `aria-checked:` in
 * `optionClassName`. With no `value`, none is picked.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  optionClassName,
}: {
  label: string;
  options: readonly Segment<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  className?: string;
  optionClassName?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.content ? option.label : undefined}
          className={optionClassName}
          onClick={() => onChange(option.value)}
        >
          {option.content ?? option.label}
        </button>
      ))}
    </div>
  );
}
