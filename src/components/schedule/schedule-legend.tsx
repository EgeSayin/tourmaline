const ENTRIES = [
  { label: "Fixed", swatch: "border border-sky-200 bg-sky-100 dark:border-sky-800 dark:bg-sky-900/60" },
  { label: "Fixed, optional", swatch: "border border-dashed border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/50" },
  { label: "Scheduled", swatch: "border-l-[3px] border-violet-500 bg-violet-50 dark:bg-violet-950/50" },
];

export function ScheduleLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {ENTRIES.map(({ label, swatch }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={`size-3 rounded-[2px] ${swatch}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}
