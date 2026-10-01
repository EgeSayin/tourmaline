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

# Code style

- Comments only for non-obvious contracts or reasons. No tutorial explanations, usage advice, or comments restating the code.
