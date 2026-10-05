// Generates docs/generated/architecture-graphs.md from the import graph: `npm run docs:graphs`.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const OUTPUT = "docs/generated/architecture-graphs.md";
const EXCLUDE = "^src/components/ui/|^src/lib/utils\\.ts$|\\.css$";

/** Areas drawn on their own: each module in `focus`, with the modules it imports and that import it. */
const AREAS = [
  { title: "Page and calendar data", focus: "^src/(app/page\\.tsx|server/calendar\\.ts|lib/calendar-blocks\\.ts)$" },
  { title: "Item commands and form", focus: "^src/(server/items/|lib/item-form\\.ts)" },
  { title: "Planning", focus: "^src/server/planning/" },
  { title: "Scheduler", focus: "^src/server/scheduler/" },
  { title: "Recurrence", focus: "^src/(server/recurrence|lib/recurrence)\\.ts$" },
  { title: "Data layer", focus: "^src/server/db/" },
  { title: "Item UI", focus: "^src/components/(items|forms)/" },
  { title: "Schedule UI", focus: "^src/components/schedule/" },
  { title: "Time", focus: "^src/(lib|server)/time/" },
];

const cruise = (...args) =>
  execFileSync(
    "npx",
    ["depcruise", "src", "--config", ".dependency-cruiser.cjs", "--exclude", EXCLUDE, "-T", "mermaid", ...args],
    { encoding: "utf8" },
  ).trim();

const section = (title, description, mermaid) => `## ${title}\n\n${description}\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n`;

const markdown = [
  "# Architecture graphs\n",
  "Generated from the import graph by `npm run docs:graphs`; don't edit by hand. An arrow points from a module to one it imports. See [architecture.md](../architecture.md) for what the layers mean.\n",
  section(
    "Layers",
    "Each folder under `src/` as one node, with `lib` and `hooks` as a single node each, since everything uses them.",
    cruise("--collapse", "^src/(lib|hooks)|^src/[^/]+/[^/]+"),
  ),
  ...AREAS.map(({ title, focus }) =>
    section(
      title,
      `Modules matching \`${focus}\` (highlighted), with the modules they import and that import them.`,
      cruise("--focus", focus),
    ),
  ),
].join("\n");

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, markdown);
