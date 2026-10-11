# Schedule

A personal auto-scheduler. Fixed items keep their time; tasks get placed in the free time before their deadline,
most important first, and are planned again whenever something changes. See [docs/architecture.md](docs/architecture.md).

## Setup

```bash
docker compose up -d          # Postgres
cp .env.example .env.local
npm install
npm run db:migrate
npm run db:seed               # optional: a sample week
npm run dev
```

With `DEMO_MODE=true` it runs as the public demo: a welcome page offers each visitor a private guest workspace
seeded with the sample week, kept through an httpOnly session cookie and deleted after a week unused. Nothing about
visitors is stored but a hash of their session token.

## Checks

```bash
npm run lint && npm run format:check
npm test                      # Vitest; needs the database for the integration tests
npm run test:e2e              # Playwright, against a production build on port 3100
```
