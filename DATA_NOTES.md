# Data exploration notes

Snapshot pulled via `scripts/dump.mjs` (reference date from `X-Mock-Reference-Date`: **2026-11-01**). Full pull ≈ 11 s, no rate-limit headers, no 429s at concurrency 8.

## Volumes

| Source | Rows |
|---|---|
| Billing customers | 239 |
| Billing subscriptions (`status=all`) | 239 (1 per customer) |
| Billing invoices | 2,138 |
| Product clients | 238 |
| Support tickets | 888 |
| Lead lists | 238 (12 empty = onboarding) |

Data spans 2025-05 → 2026-10. All monthly, AUD, quantity 1.

## Anomalies found → how we handle them

| # | Finding | Handling |
|---|---|---|
| 1 | `cus_ur2qIvHtoDhfVV` "Internal Test Account" (test@example.com, `price_internal_test` $1, 6 invoices of 100¢) | Exclude everywhere |
| 2 | `cus_vZ9pgO4NI7NnL8` "Southern Plumbing" with UPPERCASE email, no product client, canceled sub, single **void** invoice. Real Southern Plumbing (`cl_0015` → `cus_iHYdZIadzncEo6`) created a day earlier | Duplicate/abandoned signup → exclude, list in data-quality |
| 3 | `cl_0035` "Keystone Trades" points to `cus_3R8wHJC7XPiq3t`, which doesn't exist in billing. Also `trade = null`, ads enabled in product | Keep in product metrics (leads, health); exclude from revenue/LTV/ads-billing; flag "billing link broken" |
| 4 | 8 clients with `trade = null`; 7 of them are on `price_growth_standard` (base plan price has trade suffix for everyone else, always consistent) | Bucket as **"Unknown"** — show it, don't drop it, don't guess |
| 5 | Landscaper: only 4 clients (3 cancelled); Unknown: 8 | Low-confidence badge (n < 10), no ranking claims |
| 6 | `cl_0001` has a 2-month gap in leads (2025-08, 2025-09 missing) | Treat as missing, **not** zero |
| 7 | First live month is partial: avg 4.0 leads vs 9.9 later | Exclude month of go-live from leads-per-month |
| 8 | One fully refunded paid invoice (`cus_lPWhKqJN86qcYn`, 2025-07, $397) | Net revenue = `amount_paid − post_payment_credit_notes_amount` |
| 9 | 14 `uncollectible` invoices (4 attempts each) → all belong to `payment_failed` cancellations | Involuntary churn, reported separately |
| 10 | 3 `past_due` subs = 3 `delinquent` customers = 3 `open` invoices (Oct 2026, 2–3 attempts, next retry 2026-11-03) | Strongest at-risk signal; deadline is in 2 days |
| 11 | `cl_0212` `last_login_at` is **before** signup and no onboarding steps at all, 70 days in | Data error; treat as "never logged in" |
| 12 | Product `ads.enabled` matches billing ads item for all linked clients; `ads.enabled_at` = item `created`. Ads is always added **after** start (never at signup) | Billing is source of truth; ads start date usable for "before/after ads" analysis |
| 13 | Product `status` agrees with billing for every linked client (`live`↔`active/past_due`, `cancelled`↔`canceled`, `onboarding`↔`active`) | Use billing for revenue/churn dates, product for lifecycle |
| 14 | Onboarding clients are already billed (sub starts at signup) | Stuck onboarding = paying without value → high risk |
| 15 | Lead lists ordered oldest-first; cancelled clients' leads stop at cancel month; no Nov-2026 rows | Last full month = 2026-10 |

## Churn wave Aug–Oct 2026 (found while building metrics)

- 48 of 64 cancellations happened in Aug–Oct 2026 (16 / 22 / 10). Before that it was 0–4 per month (≈0.8%/mo → ≈8.9%/mo).
- Before the wave, every churn happened in months 1–3 (mostly `unused`, `too_complex`). In the wave, 40 of 48 were tenured 7+ months and cited `low_quality` 15, `too_expensive` 13, payment_failed 9.
- **Leads collapse before cancellation**: most wave churners show a 3-month slide in leads before leaving (e.g. 7 → 4 → 1) from a normal baseline. That makes falling leads an *early* warning, which is the bonus candidate: backtest it.
- Ads clients who left mostly cited price (9 of 13): when leads drop, paying $149/mo + ad budget feels expensive.
- Invoice amounts didn't change around August, so this is not a price rise.

## Early signals worth noting

- **Electricians**: highest price ($397) and 22/60 cancelled (37%) vs plumbers 10/62 (16%) — most churn after 6 months → results problem, not onboarding. Strong candidate for "which trade is the best business".
- **Onboarding**: median signup→live 15 days, p90 35, max 60. Currently stuck: `cl_0212` (70 d, nothing received), `cl_0216` (55 d), `cl_0223` (40 d) — all electricians.
- **Zero leads in Sep+Oct 2026** while live: `cl_0065`, `cl_0140` (both previously healthy → sudden drop to 0, looks like a technical failure).
- **Cancellation feedback** (65): low_quality 15, null 14, too_expensive 13, unused 10, switched_service 8, too_complex 4, other 1. `payment_failed`: 9.
- Last login among live: 157/162 within 30 days → "no login" is a rare, therefore meaningful, signal.
- Tickets in last 30 days: most clients 1; a handful have 4–6 → spike signal.
