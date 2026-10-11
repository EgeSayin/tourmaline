import { Pin } from "lucide-react";
import { BLOCK_FILL, BLOCK_STYLES } from "./block-styles";

export function ScheduleLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {Object.values(BLOCK_STYLES).map(({ label, className }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={`size-3.5 rounded-[3px] no-underline ${BLOCK_FILL} ${className}`} />
          {label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <Pin className="size-3" />
        Pinned
      </li>
    </ul>
  );
}
