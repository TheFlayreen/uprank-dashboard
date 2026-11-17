# UpRank Dev Challenge: original plan

> This is the plan written before the build started, kept for reference. Some choices changed during the work: charts are hand-written SVG instead of Recharts, there is no shadcn/ui, metric code lives in `src/server/metrics` rather than `lib/metrics`, and the bonus became the early-warning backtest. See [WRITEUP.md](WRITEUP.md) for what was built and why.

Goal: a one-page dashboard (Next.js + TypeScript + Postgres) that shows, within a minute, what is happening and what to do next. Budget: 4 hours (no less; spare time goes into iteration and is noted in the write-up).

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Required |
| Database | Postgres in `docker-compose` | Required; easy for a reviewer to start |
| ORM | Prisma 7 (driver adapter `@prisma/adapter-pg`) | Typed schema, migrations |
| ETL | `npm run sync` script + button / `POST /api/sync` | Live data from the APIs, nothing hard-coded |
| Calculations | Server module `lib/metrics/*` (SQL + TS) → `GET /api/dashboard` | Required: "joining happens on the server" |
| UI | shadcn/ui + Tailwind + Recharts | Fast and clean |
| Tests | Vitest for the metric functions | Proof that the definitions are correct |

## Architecture

```
Billing API ─┐                 ┌─ raw tables (customers, subscriptions, invoices,
             ├─ sync (ETL) ──► │   clients, leads, tickets)
Product API ─┘                 └─ joined view: client_facts (1 row per client)
                                          │
                               lib/metrics/* (health, retention, leads, ltv, ads, bonus)
                                          │
                               GET /api/dashboard  →  page.tsx (Server Component)
```

- The reference date comes from the `X-Mock-Reference-Date` header (2026-11-01) and is stored in a `sync_meta` table. Never use `Date.now()`.
- Pagination: billing uses `starting_after` + `has_more` with limit=100; product uses `page`/`total_pages` with per_page=100. Retry with backoff on 429/5xx.
- **Pitfalls:** `subscriptions` without `status=all` omits cancelled ones; amounts are in cents; billing dates are Unix seconds, product dates are ISO; `trade` can be `null`; `stripe_customer_id` can be missing or broken; a client can have several subscriptions; ads status in product and the add-on in billing may disagree; the current month (November 2026) is partial.

## Step 0: Data exploration (~30 min), the most important step

A script `scripts/explore.ts` that pulls everything and counts anomalies:
- how many clients have no `stripe_customer_id`, customers with no client, duplicates;
- the `trade` distribution (including null and spelling variants such as `Plumber`, `plumber `);
- clients with several subscriptions, subscriptions without a base plan;
- mismatches between `ads.enabled` and the billing add-on item;
- invoices: `void`, `uncollectible`, refunds (`post_payment_credit_notes_amount`), `attempt_count > 1`;
- whether product `status=cancelled` matches billing `canceled`;
- group sizes by trade (to know where samples are small).

Results go into a "Data quality" section. This is where the reviewer sees how you think.

## Step 1: Skeleton + ETL (~45 min)

1. `create-next-app`, Tailwind, shadcn, Prisma, `docker-compose.yml` with Postgres, `.env.example` (`UPRANK_API_KEY`, `DATABASE_URL`).
2. Schema for the raw tables + `sync_meta`.
3. Two API clients (`lib/api/billing.ts`, `lib/api/product.ts`) with their different auth and pagination.
4. `sync`: upsert everything; leads per client (in parallel with limited concurrency, e.g. 5).
5. SQL view / TS function `client_facts`: client + customer + main subscription + MRR + ads + tenure + recent leads + tickets.

## Step 2: Metric definitions (~20 min, written down in `METRICS.md`)

Proposed definitions (to refine after step 0):

**Normalisation**
- `trade`: lowercase/trim; `null` → "Unknown" (shown separately, not dropped).
- Clients without a billing link stay in product metrics (leads), are excluded from revenue/LTV, and are counted under data quality.
- A month is full if it ended before the reference date → the last full month is October 2026.

**1. Health score (0–100, lower is worse):** a sum of penalties, each with an explanation.

| Signal | Rule | Penalty |
|---|---|---|
| Failed payment | Open/uncollectible invoice or `attempt_count>1` in 60 days, or `past_due` | 30 |
| Zero leads | 0 leads in the last 2 full months (live ≥ 2 months only) | 25 |
| Falling leads | Average of the last 3 months < 60% of the 3 before | 15 |
| Ticket spike | ≥3 tickets in 30 days, or 2× the client's own average | 10 |
| Stuck onboarding | `onboarding` > 30 days from signup without `live_at` | 20 |
| No login | `last_login_at` > 30 days (21–30 → smaller penalty) | 10 |

- Active clients only. Ranking: score ascending, then MRR descending (call the clients worth more first).
- Each row has reason chips ("0 leads in Sep–Oct", "Payment failed 12 Oct"), so the account manager knows what to talk about.
- Weights are constants in one file so they're easy to change; the write-up explains them (a failed payment is the strongest signal of imminent churn).

**2. Retention**
- Retention: % of all clients ever signed up who are still active, plus 3/6/12-month figures (only for cohorts old enough to reach them: right-censoring).
- Timing: tenure of cancelled clients = `canceled_at − start_date` → buckets 1–3 / 4–6 / 6+ months, broken down by `cancellation_details.reason` and `feedback` (early → onboarding/expectations, late → results).
- Separate `payment_failed` (involuntary churn) from `cancellation_requested`.

**3. Leads by trade**
- Leads per client-month = Σ leads / Σ live client-months (weighted, not a mean of means); median alongside.
- Exclude the partial go-live month and the current partial month.
- Confidence: n clients and n client-months; a "Low confidence" badge if < 5 clients; 95% CI (bootstrap or t-interval) as error bars.

**4. Revenue & LTV by trade**
- ARPA = average net paid revenue per month (paid − refunds, excluding void) per client.
- Average months retained: not the average of cancelled clients only (biased!). Use `1 / monthly churn rate` or Kaplan–Meier; show both with an explanation.
- LTV = ARPA × average months retained. Visual: scatter (x = ARPA, y = months retained, size = number of clients) with LTV iso-lines, so "pays less but stays 3× longer" is visible at once.

**5. Ads add-on**
- Attach rate (billing as the source of truth; product mismatches go to data quality).
- Retention with/without ads + churn rate per client-month, **controlled for tenure/trade** (loyal clients tend to add ads: selection bias). Compare churn **after** adding ads with the same period without ads.
- `too_expensive` feedback for clients with vs without ads → answers "do they leave because of the price?".
- Small samples → show n and avoid strong claims.

## Step 3: Calculation backend (~50 min)

- `lib/metrics/health.ts`, `retention.ts`, `leads.ts`, `ltv.ts`, `ads.ts`: pure functions over `client_facts` (easy to test).
- Vitest tests for edge cases: null trade, a client with no leads, several subscriptions, a refund.
- `GET /api/dashboard` returns ready JSON (with `referenceDate`, `generatedAt`, `dataQuality`).

## Step 4: UI (~50 min), hierarchy "action → diagnosis → strategy"

1. **Header:** reference date, 4–5 KPIs (active clients, MRR, retention, MRR at risk, number of clients to call).
2. **Who to call this week:** a full-width table with reason chips, MRR, phone/email, sorting. The first thing you see.
3. **Retention & timing:** stacked bar by bucket 1–3/4–6/6+ with reasons + a one-sentence conclusion.
4. **Leads by trade:** bars with error bars, n under each, low-confidence groups muted.
5. **Revenue & LTV by trade:** ARPA × retention scatter + table.
6. **Ads add-on:** with/without comparison cards + conclusion.
7. **Bonus.**
8. **Data quality:** a collapsed block at the end.

Each block has an auto-generated one-line insight (e.g. "Electricians: highest LTV despite lower ARPA").

## Step 5: Bonus (~30 min, only once views 1–5 work)

Pick one after data exploration. Candidates, in priority order:
1. **Onboarding speed → early churn:** signup→live time vs churn in months 1–3. If the link is strong, the decision is "launch SLA ≤ N days" plus an alert for clients currently onboarding longer than N days. Follows directly from the brief's hint about early churn.
2. **MRR at risk + expected loss:** health score → churn probability (calibrated on historical data), queue sorted by `P(churn) × MRR`.
3. **Leads → retention threshold:** "clients with < X leads/month in their first 3 months leave N times more often", which gives the team a concrete KPI.

## Step 6: Documentation and delivery (~25 min)

- `README.md`: what it is, setup (`docker compose up -d`, `cp .env.example .env`, `npm i`, `npm run db:migrate`, `npm run sync`, `npm run dev`), screenshots.
- `METRICS.md`: exact formulas and thresholds.
- `WRITEUP.md`: decisions and why; trade-offs (ETL into a database vs on the fly; KM vs naive average); data quality; the bonus and the decision it changes; time log (if finished early, what was iterated).
- Public GitHub repository, meaningful commits per step.

## Timebox

| Step | Time |
|---|---|
| 0. Data exploration | 0:30 |
| 1. Skeleton + ETL | 0:45 |
| 2. Metric definitions | 0:20 |
| 3. Calculation backend | 0:50 |
| 4. UI | 0:50 |
| 5. Bonus | 0:30 |
| 6. Documentation | 0:25 |
| **Total** | **~4:10** |

## Delivery checklist

- [x] Live data from both APIs, joined on the server
- [x] Postgres + server-side calculations, the frontend receives ready data
- [x] One page, actions at the top
- [x] All 5 required views
- [x] Metrics precisely defined (METRICS.md)
- [x] Bonus
- [x] Setup instructions
- [x] Write-up (including the bonus)
