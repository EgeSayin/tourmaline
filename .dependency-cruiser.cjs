// Layer rules, checked by `npm run lint:deps`. docs/architecture.md explains the layers.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Modules must not depend on each other in a cycle.",
      from: {},
      to: { circular: true },
    },
    {
      name: "lib-is-browser-safe",
      severity: "error",
      comment: "src/lib is shared by server and client code, so it depends on nothing outside itself.",
      from: { path: "^src/lib/" },
      to: { path: "^src/(app|components|hooks|server)/" },
    },
    {
      name: "client-imports-server-types-only",
      severity: "error",
      comment: "Client code may import types from src/server, and call server actions, but no other server code.",
      from: { path: "^src/(components|hooks)/" },
      to: {
        path: "^src/server/",
        pathNot: "^src/server/(items|categories|settings)/actions\\.ts$",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "repositories-only-save",
      severity: "error",
      comment: "The data layer depends on the domain and the database, never on the layers that use it.",
      from: { path: "^src/server/db/" },
      to: { path: "^src/server/(calendar|items|planning|recurrence|scheduler|settings|demo)" },
    },
    {
      name: "scheduler-is-pure",
      severity: "error",
      comment: "The scheduler is pure functions over domain values: no database, no orchestration.",
      from: { path: "^src/server/scheduler/" },
      to: { path: "^src/server/(calendar|db|items|planning|demo)" },
    },
    {
      name: "planning-below-features",
      severity: "error",
      comment: "Planning serves the page and the commands; it doesn't depend on them.",
      from: { path: "^src/server/planning/" },
      to: { path: "^src/server/(calendar|items)" },
    },
    {
      name: "commands-below-page",
      severity: "error",
      comment: "Item commands don't depend on page data.",
      from: { path: "^src/server/items/" },
      to: { path: "^src/server/calendar" },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment: "A module nothing imports is dead code, unless it's an entry point.",
      from: {
        orphan: true,
        // Entry points; lib/utils.ts is where the shadcn CLI (components.json) expects its helper.
        pathNot: [
          "^src/app/",
          "^src/server/db/schema\\.ts$",
          "^src/server/demo/seed\\.ts$",
          "\\.d\\.ts$",
          "^src/components/ui/",
          "^src/lib/utils\\.ts$",
        ],
      },
      to: {},
    },
  ],
  options: {
    includeOnly: "^src/",
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default"] },
  },
};
