import { Pin } from "lucide-react";
import { BLOCK_FILL, BLOCK_STYLES, BUFFER_STYLE, CONFLICT_STYLE } from "./block-styles";

export function ScheduleLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {[...Object.values(BLOCK_STYLES), CONFLICT_STYLE].map(({ label, className }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={`size-3.5 rounded-[3px] no-underline ${BLOCK_FILL} ${className}`} />
          {label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        {/* A darker fill than a block's, so the faded stripes show at this size. */}
        <span
          className={`size-3.5 rounded-[3px] bg-slate-400 dark:bg-slate-500 ${BUFFER_STYLE.className}`}
          style={BUFFER_STYLE.style}
        />
        {BUFFER_STYLE.label}
      </li>
      <li className="flex items-center gap-1.5">
        <Pin className="size-3" />
        Pinned
      </li>
    </ul>
  );
}
