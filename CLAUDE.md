@AGENTS.md

# Project structure

```
src/
  app/          Next.js routes only; keep thin
  components/   ui/ for shadcn primitives, forms/ for shared form fields, <feature>/ for feature UI
  hooks/        shared client hooks
  lib/          browser-safe shared code: domain types, constants, pure helpers
  server/       server-only code; every file starts with `import "server-only"`
                (except db/schema.ts, which drizzle-kit loads outside Next.js)
tests/          mirrors src/; shared helpers and generators in tests/support/
```

- Define each type in the module that owns the concept. No catch-all type files.
- No barrel `index.ts` files; import from the defining file.
- Split components by responsibility: data shaping goes in `lib/` (pure, testable), repeated or self-contained UI pieces become their own components; don't split further than that.
- Client code may `import type` from `src/server/`, never runtime values.
- Configurable values come from settings with named defaults, never inline literals.
- Scripts that run outside Next.js (e.g. `db:seed`) use `tsx --conditions=react-server` so `server-only` imports resolve.

# Tests

- Vitest, in `tests/`. Prefer a few comprehensive scenario tests over many single-assertion tests.
- Tag tests `unit` (runs in isolation) or `integration` (needs external services). Set up services through lazy fixtures so unit runs never touch them; database tests use `dbTest` from `tests/support/database.ts`, whose `tx` is rolled back after each test.
- Example tests cover important and boundary cases. Add a property-based test only when a guarantee is easy to state and hard to get right, and keep it simpler than the code under test. Write properties as plain `it(..., { tags: ["property"] }, () => fc.assert(fc.property(...)))` with `fast-check`, in the same `describe` as the examples.
- End-to-end tests are Playwright specs in `tests/e2e/` (`npm run test:e2e`), run against their own seeded database (`E2E_DATABASE_URL`) on desktop and phone profiles. Make assertions hold whatever weekday the suite runs on.
- Tag `critical` when a failure wouldn't be caught easily without the test and breaks core functionality.

# Code style

- Format with Prettier (`npm run format`); `format:check` must pass.
- `src/components/ui/` is vendored shadcn code: update it through the shadcn CLI, don't hand-edit it.
- Comments only for non-obvious contracts or reasons. No tutorial explanations, usage advice, or comments restating the code.
- Output guarantees stated in a doc comment must be enforced by a test. Input preconditions may be documented and assumed without tests.
