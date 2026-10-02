import { BLOCK_STYLES } from "./block-styles";

export function ScheduleLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {Object.values(BLOCK_STYLES).map(({ label, className }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={`size-3 rounded-[2px] ${className}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}
