@AGENTS.md

# Project structure

```
src/
  app/          Next.js routes only; keep thin
  components/   ui/ for shadcn primitives, forms/ for shared form fields, <feature>/ for feature UI
  hooks/        shared client hooks
  lib/          browser-safe shared code: domain types, constants, pure helpers
  server/       server code; db/client.ts and time/temporal.ts import "server-only", which covers the rest
tests/          mirrors src/; shared helpers and generators in tests/support/
```

- Define each type in the module that owns the concept. No catch-all type files, no barrel `index.ts` files.
- Client code may `import type` from `src/server/`, and call server actions, but import no other server code.
- Configurable values come from settings with named defaults, never inline literals.
- Scripts that run outside Next.js (e.g. `db:seed`) use `tsx --conditions=react-server` so `server-only` resolves.

# Tests

- Vitest, in `tests/`. Prefer a few comprehensive scenario tests over many small ones, and test behaviour at the
  highest level that pins it down; don't re-test helpers that a bigger test already covers.
- Database tests use `dbTest` from `tests/support/database.ts`; its `tx` is rolled back after each test.
- Add a property-based test (`fast-check`) only when a guarantee is easy to state and hard to get right.
- End-to-end tests are Playwright specs in `tests/e2e/` (`npm run test:e2e`), run against their own seeded database
  (`E2E_DATABASE_URL`) on desktop and phone. Make assertions hold whatever day and time the suite runs at.

# Code style

- Format with Prettier (`npm run format`); `format:check` must pass.
- `src/components/ui/` is vendored shadcn code: update it through the shadcn CLI, don't hand-edit it.
- Comments only for non-obvious contracts or reasons, kept short. Never restate the code.
