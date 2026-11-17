# CLAUDE.md

@AGENTS.md
@CONVENTIONS.md

## Project

A one-page decision dashboard for a subscription business that serves trade businesses. Data comes from two mock APIs (Stripe-style billing and product), is synced into Postgres, joined into per-client facts, and turned into metrics on the server.

- `PLAN.md`: original plan and timebox
- `DATA_NOTES.md`: data quirks found during exploration and how each is handled
- `METRICS.md`: exact metric definitions (keep in sync with `src/server/metrics`)

## Commands

```bash
npm run db:up         # Postgres in Docker (port 5433)
npm run db:migrate    # apply Prisma migrations
npm run sync          # pull both APIs into Postgres (+ writes data/snapshot)
npm run dev           # http://localhost:3000
npm run typecheck && npm run lint && npm test
```

## Gotchas

- Next.js 16 with `cacheComponents: true`: read `node_modules/next/dist/docs/` before using Next APIs. There's no `export const dynamic`; use `connection()` inside `<Suspense>`.
- Prisma 7: the client is generated to `src/generated/prisma` (`npm run db:generate`), and the DB URL lives in `prisma.config.ts`.
- The API key lives only in `.env`. Never print it, commit it or put it in code.
