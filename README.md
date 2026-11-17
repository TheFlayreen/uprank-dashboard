# UpRank client health dashboard

A one-page decision dashboard for a subscription business that serves trade businesses (plumbers, electricians, roofers…). It pulls a Stripe-style **billing API** and a **product API**, syncs both into Postgres, joins them into one record per client on the server, and turns that into five decision views plus an early-warning backtest.

Open it and, within a minute, you know who to call this week, why, and what is happening to the business.

- **[WRITEUP.md](WRITEUP.md)**: thought process, trade-offs, the bonus feature
- **[METRICS.md](METRICS.md)**: exact definition of every number on the page
- **[DATA_NOTES.md](DATA_NOTES.md)**: data quirks found in the APIs and how each one is handled
- **[CONVENTIONS.md](CONVENTIONS.md)**: architecture and code rules for this repo

## What's on the page

| Section | Question it answers |
|---|---|
| Overview | Five KPIs with trends (MRR, active clients, churn, 12-month survival, LTV), a four-line briefing and the actions that have a deadline |
| **Call list** | Who should we call this week? Ranked by a health score, with the reasons and a suggested action for each client |
| **Early warning** (bonus) | Does a lead slump predict cancellation? A point-in-time backtest of the rule the call list uses |
| **Retention** | How many clients we keep, and whether they leave in months 1–3, 4–6 or after 6 |
| **Results by trade** | Leads per client per month by trade, with confidence intervals and sample sizes |
| **Best trades** | Revenue per client and lifetime value by trade, and the "pays less but stays longer" trade-off |
| **Ads add-on** | Uptake, and churn with vs without ads, corrected for selection bias |
| Data quality | What was excluded or flagged, and why |

## Requirements

- Node.js 22+ and npm
- Docker (for Postgres), or any Postgres 14+ you point `DATABASE_URL` at
- An API key for the UpRank hiring-mock API

## Setup

1. Install dependencies. This also generates the Prisma client.

   ```bash
   npm install
   ```

2. Create `.env` from the example and put your API key in `UPRANK_API_KEY`. The API URLs and the local database URL are already filled in.

   ```bash
   cp .env.example .env
   ```

3. Start Postgres (Docker, port 5433) and apply the migrations.

   ```bash
   npm run db:up
   ```

   ```bash
   npm run db:migrate
   ```

4. Pull both APIs into Postgres. This takes about 10 seconds. It reads "today" from the `X-Mock-Reference-Date` header and also writes a JSON snapshot to `data/snapshot/` (git-ignored).

   ```bash
   npm run sync
   ```

5. Start the app and open http://localhost:3000.

   ```bash
   npm run dev
   ```

The **Refresh data** button in the header re-runs the sync (`POST /api/sync`) and re-renders the page. If the database is empty, the page shows these setup steps instead of an error.

### Offline fallback

If the API is unreachable, `npm run sync:snapshot` loads the last saved snapshot from `data/snapshot/` instead. The default path is always the live API; nothing on the page is hard-coded.

### Production build

```bash
npm run build
```

```bash
npm start
```

## Checks

```bash
npm run typecheck && npm run lint && npm test
```

The Vitest suite covers the join, every metric and the backtest, including a test that the backtest never reads data from after its snapshot date. Tests don't need a database.

## Environment variables

| Variable | Purpose |
|---|---|
| `UPRANK_API_KEY` | API key. Sent as `Authorization: Bearer` to billing and `X-API-Key` to product. Only ever read from `.env`. |
| `BILLING_API_URL` | Billing (Stripe-style) API base URL |
| `PRODUCT_API_URL` | Product API base URL |
| `DATABASE_URL` | Postgres connection string (read in `prisma.config.ts` and `src/server/db.ts`) |

## How it works

```
Billing API ─┐                    ┌─ raw, typed copies of both systems (Prisma)
             ├─ sync (ETL) ──────►│  + sync_runs (reference date per sync)
Product API ─┘                    └─────────────┐
                                                ▼
                         server/facts   one ClientFact per client (the only place
                                        billing and product are joined)
                                                ▼
                         server/metrics pure functions: health, retention, leads,
                                        economics, ads, early warning (unit-tested)
                                                ▼
                         server/dashboard.ts → display-ready payload
                                                ▼
                         app/page.tsx (Server Component) and GET /api/dashboard
```

- **Sync** (`src/server/sync`, `src/server/sources`): paginates both APIs (billing `starting_after`, product `page`), fetches cancelled subscriptions with `status=all`, retries on 429/5xx, and writes everything in one transaction.
- **Facts** (`src/server/facts`): joins product `stripe_customer_id` to billing. Excluded rows and broken links are kept and reported, not silently dropped.
- **Metrics** (`src/server/metrics`): pure TypeScript over `ClientFact[]` and a reference date. No database, no `fetch`, no system clock.
- **UI** (`src/components`): Server Components by default. Client components (call-list filter, section navigation, theme toggle, refresh) only receive data that is already computed.

### Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript (strict) · Postgres 16 · Prisma 7 · Tailwind CSS 4 · Vitest. Charts are hand-written SVG, so there is no charting dependency.

## Project layout

```
src/
  app/                 page.tsx, layout.tsx, api/dashboard, api/sync
  components/ui/       generic building blocks (Section, StatTile, Tooltip…)
  components/dashboard one folder per section (call-list, retention, leads, …)
  lib/                 deterministic formatting, theme
  server/sources/      HTTP clients for the two APIs
  server/sync/         ETL into Postgres
  server/facts/        the join → ClientFact[]
  server/metrics/      metric functions + tests
prisma/                schema and migrations
scripts/               sync and data-exploration CLIs
```
