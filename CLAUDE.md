@AGENTS.md

# Project structure

```
src/
  app/          Next.js routes only; keep thin
  components/   ui/ for shadcn primitives, <feature>/ for feature UI
  lib/          browser-safe shared code: domain types, constants, pure helpers
  server/       server-only code; every file starts with `import "server-only"`
tests/          mirrors src/
```

- Define each type in the module that owns the concept. No catch-all type files.
- No barrel `index.ts` files; import from the defining file.
- Client code may `import type` from `src/server/`, never runtime values.
- Configurable values come from settings with named defaults, never inline literals.

# Tests

- Vitest, in `tests/`. Prefer a few comprehensive scenario tests over many single-assertion tests.
- Tag tests `unit` (runs in isolation) or `integration` (needs external services). Set up services through lazy fixtures so unit runs never touch them.
- Pair example tests for important cases with property-based tests for output guarantees, side by side in the same `describe`. Write properties as plain `it(..., { tags: ["property"] }, () => fc.assert(fc.property(...)))` with `fast-check`.
- Tag `critical` when a failure wouldn't be caught easily without the test and breaks core functionality.

# Code style

- Comments only for non-obvious contracts or reasons. No tutorial explanations, usage advice, or comments restating the code.
- Output guarantees stated in a doc comment must be enforced by a test. Input preconditions may be documented and assumed without tests.
