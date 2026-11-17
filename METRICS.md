# Metric definitions

Every number on the dashboard is computed on the server from one joined record per client (`src/server/facts`). This file is the contract: if a definition changes, it changes here and in the code (`src/server/metrics/*`), and the tests in `*.test.ts` pin it down.

## Ground rules

| Topic | Rule |
|---|---|
| **"Today"** | `X-Mock-Reference-Date` from the API (2026-11-01), stored per sync. The system clock is never used. |
| **Full month** | Only months that ended before the reference date count. With today = 1 Nov, the last full month is **October 2026**. |
| **Joining** | Product `stripe_customer_id` → billing customer. No database foreign key across systems, because one link is broken and that row should be kept and reported, not dropped. |
| **Excluded** | Billing customers with no product client: the internal test account, and a duplicate signup that only has a void invoice. They are listed under *Data quality* with the reason. |
| **Broken link** | A product client whose billing customer doesn't exist stays in the product metrics (leads, health) and is left out of the revenue, LTV and ads metrics. |
| **Trade** | Lower-cased and trimmed. `null` becomes **"Unknown trade"**, which is shown as its own group, always last, and never guessed from the price. |
| **Source of truth** | Billing for money, the ads add-on and cancellation dates. Product for trade, onboarding, logins, leads and tickets. |
| **Active / churned** | Churned = billing subscription `canceled` (or product `cancelled`). Everyone else is active, including clients still in onboarding (they're paying). |
| **Tenure** | Subscription `start_date` → `canceled_at` (or → reference date if still active), measured in average months (30.44 days). |
| **Revenue** | Paid invoices: `amount_paid − post_payment_credit_notes_amount`. Void, open and uncollectible invoices earn nothing. Includes the ads add-on fee, because that's our revenue. The client's ad *budget* is not ours. |
| **Comparable lead months** | The go-live month is dropped because it's partial (≈4 leads vs ≈10 in later months). Months after the last full month are dropped. Missing months stay missing; they are never filled with 0. |
| **Small samples** | Applies to every by-trade comparison: n < 5 is **insufficient** (greyed out, no claims made), n < 15 is **low** (shown with a warning), otherwise **ok**. |

## 1. Who should we call this week? (health score)

`score = 100 − Σ penalties`, floored at 0. The penalties are additive, so every lost point maps to a written reason in the UI.

| Signal | Fires when | Penalty |
|---|---|---|
| **Payment failing** | Open invoice with failed attempts, **or** subscription `past_due`, **or** customer `delinquent` | 40 |
| Payment needed retries | Paid invoice that needed > 1 attempt in the last 90 days (only if the signal above didn't fire) | 5 |
| **Zero leads** | Live client with 0 leads in the last full month: 30 if both of the last 2 full months were 0, otherwise 12 | 30 / 12 |
| **Leads falling** | The last full month is ≥ 40% below the average of the 3 months before it (at least 2 of those must exist), with a baseline of ≥ 3 leads/month. Doesn't fire if *Zero leads* already did. The rule and its weight come from the backtest (see Bonus): 96% of clients it flagged cancelled within 90 days. | 35 |
| **Support spike** | ≥ 3 tickets in the last 30 days, **or** ≥ 2 tickets that are ≥ 3× the client's own 30-day average over the previous 150 days | 10 |
| **Stuck in onboarding** | Still onboarding beyond the **historic p90** of signup→live (35 days): 30. Beyond the p75 (22 days): 12. The thresholds are computed from the data, not hard-coded, and the detail names the blocking step. | 30 / 12 |
| **Not logging in** | Last login more than 30 days ago: 15. More than 60 days: 20. No valid login on record: 15. | 15 / 20 |

**Tiers:** < 50 critical · < 70 at risk · < 90 watch · ≥ 90 healthy.
**Call list:** active clients with any signal, sorted by score ascending, then by MRR descending (so among equally risky clients, the one worth more comes first). "Call this week" = tiers below healthy.
**MRR at risk:** the MRR of critical and at-risk clients.
**Suggested action:** follows from the strongest signal (e.g. payment → "get card updated before the next retry").

Why these weights: a failing card cancels the subscription automatically within days, so it's the most certain signal. Lead collapse is the strongest predictor of voluntary churn. The backtest measured it, so its weight is close to the payment signal's. Logins and tickets are softer hints that haven't been validated the same way, so they weigh less.

The lead rule lives in one function (`leadTrend.ts`), used by both the live score and the backtest. What's shown today is exactly what was tested.

## 2. Retention and churn timing

- **Retention rate** = active / all clients ever. This is a simple headline number.
- **Survival curve** is Kaplan–Meier by month of tenure. It counts active clients as *censored*, i.e. still alive and not yet finished, which keeps young cohorts from distorting the curve. We report the values at months 3, 6 and 12.
- **Churn timing**: each cancellation is placed in a bucket by tenure at cancel: **1–3** (≤ 3 months), **4–6** (≤ 6), **after 6**. For each bucket we show:
  - the count and share of all cancellations,
  - voluntary vs payment-failed,
  - the feedback breakdown,
  - **monthly churn rate = churns ÷ client-months lived in that window by everyone**. Raw counts are biased toward later windows, because fewer clients have reached them; the rate makes the windows comparable.
- **Trend**: for each of the last 12 full months, the number active at the start of the month, new clients, cancellations, and churn rate.
- **Spike alert**: fires when, over the last 3 months, churn per client-month is more than 2× the rate of the 9 months before, with at least 5 cancellations.

## 3. Leads per client per month, by trade

- For each client: the average of their comparable lead months (see ground rules).
- For each trade: the **mean of the client averages**, so each client counts once and a long-tenured client can't dominate a small trade. The median is shown too.
- **95% confidence interval**: a t-interval over the client averages.
- **Above / below average**: only claimed when the trade's interval doesn't include the overall mean. Otherwise "similar". "Insufficient" groups make no claim.

## 4. Revenue and lifetime value, by trade

- **Revenue per client-month** = Σ net revenue ÷ Σ paid invoices (one invoice per billed month).
- **Monthly churn (hazard)** = churns ÷ client-months at risk, where *all* clients' months count, active ones included.
- **Expected lifetime** = 1 ÷ monthly churn, capped at 60 months. The cap is flagged in the UI.
  - *Why not "average months retained of clients who left"?* That average only looks at clients who already churned, so by construction it ignores everyone who is still staying. It would rank a trade with few, early cancellations as worst.
- **LTV** = revenue per client-month × expected lifetime. The range shown comes from the 95% Poisson interval on the churn rate.
- The chart puts revenue per month against expected lifetime, so a trade that "pays less but stays 3× longer" is visible at a glance.

## 5. Ads add-on

- **Attach rate** = active clients with the ads subscription item ÷ active clients. Also shown: add-on MRR and its share of total MRR, and the median time from signup to adding ads.
- **Naive comparison** (shown for contrast only): % churned among clients with vs without ads.
- **Fair comparison**: churn per client-month **while on ads vs while not on ads**. Ads is always bought *after* signup (median ≈ 1.4 months), so "ads clients" have by definition survived their first weeks, and a naive comparison flatters the add-on. Splitting each client's timeline at the date ads started removes that bias. A cancellation counts toward the state the client was in when they left.
- **By tenure band** (1–6, 7–12, 12+ months): the same split within each band, so ads clients being older on average doesn't drive the result.
- **Price sensitivity**: among voluntary churners, the share that gave `too_expensive` as the reason, with ads vs without.
- **Verdict**: states the direction and whether the confidence intervals separate. If they overlap, it says "lean, not proof".

## Bonus: early-warning backtest

**Question:** does a lead slump predict cancellation, and how early?

- **Snapshots:** the 1st of each month from Oct 2025 to Aug 2026. Each snapshot needs a full 90-day outcome window before the reference date.
- **Population per snapshot:** clients whose subscription had started, who hadn't cancelled yet, and who were already live.
- **Signal:** the lead rule above, computed with `leadWarningAt(client, snapshotDate)`. It only uses lead months that had finished by the snapshot date, so no future data leaks in.
- **Outcome:** the client cancelled within 90 days after the snapshot.
- **Reported:**
  - **Precision:** the share of flagged client-snapshots that cancelled.
  - **Base rate:** the same share for unflagged client-snapshots.
  - **Lift:** precision ÷ base rate.
  - **Recall:** the share of cancellations that were flagged at some snapshot before they happened. Shown for all cancellations and for "results-driven" churn (voluntary, after 6+ months), which is the churn a lead rule is meant to catch.
  - **Lead time:** days from the first flag to the cancellation, as a median.
- **Threshold sweep:** 30 / 40 / 50 / 60%. 40% keeps precision at ~95% while catching almost as many leavers as 30%.
- **Rule iteration:** the first version (the average of the last 2 months vs the 3 before them) was 100% precise but caught only 10 of 44 voluntary leavers, a median 6 days ahead. Comparing just the last month caught 19, ~4 weeks ahead. This backtest is why the live rule changed.
- **Trajectory chart:** each client's leads as a % of their own average in months −6 to −4. Shown for the 6 months before cancelling (the cancel month is partial and excluded) and, for clients who stayed, for the 6 months up to today.
- **Limits:** monthly lead data means the earliest possible alert is the 1st of the month after the drop. Payment-failure churn isn't lead-driven, so it isn't expected to be caught here.

## Briefing and KPI trends

- **MRR trend:** MRR on the 1st of each month, rebuilt from subscription start and cancel dates at today's list prices (billing has no price history). The ads add-on is counted from the day it was added. The KPI compares today with 3 months ago.
- **Active-client change:** the same rebuild, counting clients.
- **"This week in one minute":** four generated sentences, built in `server/briefing.ts`. Each one is computed from the metrics above and links to its section:
  1. the call list and the earliest payment retry;
  2. the churn spike (only shown when the spike alert fires);
  3. the early-warning rule;
  4. MRR direction and the best vs. highest-paying trade.
- **"Due now":** only items with a deadline: failing payments with a scheduled retry, and onboarding past the historic p90.
