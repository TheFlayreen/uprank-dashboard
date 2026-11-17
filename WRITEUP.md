# Write-up

The brief frames this as a decision problem, not a data problem. So every choice below was tested against one question: **does this help someone decide faster, and can they trust it?** The exact formulas live in [METRICS.md](METRICS.md); this document explains the reasoning behind them.

## 1. Approach

### Explore the data before defining anything

The first step was a script (`scripts/explore.mjs`) that pulled both APIs and counted anomalies before a single metric was written. That shaped most later decisions. The full list is in [DATA_NOTES.md](DATA_NOTES.md). The ones that mattered most:

- **An internal test account and a duplicate signup** exist in billing with no product client. They are excluded, and listed under *Data quality* with the reason.
- **One product client points to a billing customer that doesn't exist.** It stays in the product metrics (leads, health) and is left out of the money metrics. That is why there is no database foreign key between the two systems: a constraint would have forced me to drop the row silently.
- **8 clients have no trade.** They become their own "Unknown trade" group, always shown last. I didn't infer the trade from the plan price, even though the price usually encodes it, because a guess presented as data is worse than an honest gap.
- **The go-live month is partial** (about 4 leads vs about 10 in a full month), so it's excluded from leads-per-month. One client has two missing lead months; they stay missing and are never filled with zeros.
- **Ads is always bought after signup** (median 1.4 months in). This turned out to be the key to the ads view (see below).
- **A churn wave.** 48 of 64 cancellations happened in Aug–Oct 2026, almost all from clients tenured 6+ months, and most of their leads had been sliding for a few months first. That finding became the bonus feature.

### Architecture: sync, join once, compute on the server

```
APIs → sync into Postgres → one join (ClientFact per client) → pure metric functions → display-ready payload → Server Components
```

- **Sync into Postgres rather than calling the APIs on every page load.** The page renders from a consistent snapshot in milliseconds. The two APIs paginate differently and authenticate differently, and that complexity stays in one place. The reference date is stored per sync, so "today" is always the API's date (1 Nov 2026), never the server clock. The data is still live: *Refresh data* re-pulls both APIs, and nothing is hard-coded.
- **Exactly one place joins the two systems** (`src/server/facts`). Every metric reads the same `ClientFact[]`, so two views can't disagree about who is active or what a client pays.
- **Metrics are pure functions** of `(facts, referenceDate)`. They have no database, no `fetch` and no clock, which is what makes them unit-testable (43 tests, no database needed) and makes the backtest possible.
- **The frontend gets data that is ready to display.** One server call builds the whole payload. Client components only handle interaction (the call-list filter, section navigation, theme, refresh).

## 2. The five views and the decisions behind them

### Who should we call this week?

The health score is `100 − penalties`, rather than a weighted model, because every lost point has to translate into a sentence an account manager can say on the phone. Each client in the list shows its reasons ("Leads down 62% vs the 3 months before"), a lead sparkline and a suggested action.

| Signal | Weight | Why |
|---|---|---|
| Payment failing | 40 | The most certain signal: a failing card cancels the subscription automatically. The three open invoices retry on 3 Nov, two days after "today", so they also show up as a deadline at the top of the page. |
| Leads falling (≥ 40% below the 3 months before) | 35 | The strongest predictor of voluntary churn. The weight is backed by the backtest: 96% of flagged clients cancelled within 90 days. |
| Zero leads (2 months / 1 month) | 30 / 12 | A client getting nothing is not getting the product. Two consecutive months is much stronger than one. |
| Stuck in onboarding (past p90 / p75) | 30 / 12 | These clients are paying without receiving value. The thresholds come from the historic signup→live distribution (p90 = 35 days), not a guess, and the detail names the blocking step. |
| Not logging in (30 / 60 days) | 15 / 20 | 157 of 162 live clients logged in within 30 days, so silence is rare and therefore meaningful. It isn't validated like the lead rule, so it weighs less. |
| Support spike | 10 | A soft hint: tickets are noisy and often mean engagement rather than risk. |

Ties are broken by MRR, so among equally risky clients the one worth more comes first. The list can be filtered by signal type, because "payment" calls and "results" calls are different conversations.

### Retention and timing

- **Headline retention** is active / all clients ever (73%). A **Kaplan–Meier survival curve** adds the honest answer to "how long do clients stay": active clients are treated as *censored*, not as failures, so young cohorts don't distort it (64% are still with us at 12 months).
- **Churn timing** is shown in the brief's three buckets (months 1–3, 4–6, after 6), with each bucket's voluntary vs payment-failed split and feedback breakdown. I also show a **monthly churn rate per bucket** (churns ÷ client-months lived in that window), because raw counts are biased: fewer clients have reached month 7 than month 2. On rate, after 6 months is both the most common time to leave (63% of cancellations) and the riskiest per month (4.6%/month). Per the brief's own framing, that is a **results** problem, not an onboarding problem.
- A trend chart and a **spike alert** show that churn jumped from 0.8% to 8.9% a month since August. That is the most important fact on the page, so it's in the KPI row and the briefing too.

### Do some trades get better results?

- Leads per client per month = the **mean of each client's own average**, so a long-tenured client can't dominate a small trade. The median is shown alongside.
- Each trade gets a **95% confidence interval** and its **n**. A trade is called above or below average only when its interval excludes the overall mean; otherwise it's "similar". Groups under 5 clients (Landscaper n=3, Unknown n=7) are greyed out with a hatched texture and make no claim. The brief explicitly asks whether there's enough data to trust each comparison, and this is the answer on every row.
- The result: plumbers are clearly above average; roofers, painters and builders are clearly below.

### Which trades are the best business?

The brief suggests LTV = average monthly revenue × average months retained. I kept that structure but changed how *months retained* is measured, because the obvious version is wrong here.

- "The average tenure of clients who left" only looks at clients who already churned, so it ignores everyone still staying. It would rank a trade with a few early cancellations as the worst.
- Instead I use **expected lifetime = 1 ÷ monthly churn rate**, where the rate counts every client-month, active clients included. It's capped at 60 months, and the cap is flagged in the UI. The LTV range comes from a Poisson interval on the churn rate.
- The chart is a **value map**: revenue per month on one axis, expected lifetime on the other. That makes the brief's example visible at a glance: electricians pay the most ($448/month), but plumbers stay 2.9× longer and are worth more over their lifetime ($21,130 vs $9,213).

### Is the ads add-on worth pushing?

This view has a selection-bias trap. Ads is always added after signup, so "clients with ads" have by definition already survived their first weeks. The naive comparison (17% vs 32% churned) flatters the add-on.

- **The fair comparison** splits each client's timeline at the day ads started, and compares churn **per month while on ads vs while not on ads**. The same split is repeated within tenure bands, so ads clients being older on average doesn't drive the result.
- **The answer:** 2.0%/month on ads vs 3.8% without, about 48% lower. The confidence intervals overlap, so the page says "a lean, not proof" rather than overselling it.
- **The second half of the question** ("do they leave because of the extra cost?") is answered from cancellation feedback: 75% of ads clients who left cited price, vs 9% of others. **My recommendation:** keep pushing ads, but watch ads clients whose leads drop. When results fall, the extra $149/month plus ad spend is what they cut first.

## 3. Bonus: early-warning backtest

**Why this one.** The churn wave showed that leads slide *before* clients cancel. If that holds up, the business can act weeks earlier instead of finding out at the cancellation. The brief asked for "one more thing that would change a decision". This one changes **when** the team intervenes, and it also validates the most important weight in the health score.

**How it works** (`src/server/metrics/earlyWarning.ts`):

1. Take a snapshot on the 1st of each month from Oct 2025 to Aug 2026 (11 snapshots). Each snapshot needs 90 days of outcome before "today".
2. At each snapshot, evaluate the lead rule for every live client that hadn't cancelled yet, using **only lead months that had finished by then**. There is a unit test proving no future data leaks in.
3. Check whether each client cancelled within the next 90 days, and report precision, base rate, lift, recall and lead time.

**The result.** Clients whose leads fell 40%+ below their own normal cancelled within 3 months **96% of the time, vs 6% of everyone else (about 17× likelier)**. The rule caught 17 of 31 long-tenured leavers, a median of about 3 weeks before they cancelled. 9 live clients show that drop right now.

**It changed the product, not just the report:**

- The first version of the rule (the average of the last 2 months) was 100% precise but caught only 10 of 44 voluntary leavers, 6 days ahead. That's too late to save anyone. Comparing just the last month catches about twice as many, about 4 weeks ahead. The backtest is why the live rule changed.
- A threshold sweep (30/40/50/60%) is shown on the page. 40% keeps precision around 95% while catching almost as many as 30%.
- **The live call list and the backtest call the same function** (`leadWarningAt`), so what's on the dashboard today is exactly what was tested.

**Its limits are stated on the page.** Lead data is monthly, so the earliest possible alert is the 1st of the month after the drop. Payment-failure churn isn't lead-driven, and the rule doesn't catch it (0 of 9), which is why payment failure is a separate signal.

## 4. Presentation choices

The order of the page follows the brief: things that need action first.

- **Top:** five KPIs with direction, a four-sentence "this week in one minute" briefing generated from the metrics, and only the items with a real deadline (failing payments before the retry, onboarding past day 35).
- **Then the call list, then the evidence.** Each section opens with a one-sentence insight computed from the data, so the reader gets the conclusion before the chart.
- **Trust is visible.** Sample sizes are on every by-group comparison, uncertain groups are greyed out, intervals are drawn, and verdicts say "lean, not proof" when the intervals overlap. Data quality issues are listed at the bottom, not hidden.
- **The visual language is quiet on purpose:** neutral greys, one accent for links, and status colours used only for state and always with a text label. Charts have one axis, captions that explain how to read them, and tooltips for exact values. It works at 375px, in light and dark mode, and with keyboard focus visible.
- **It's one page,** as the brief asks, with a scroll-spy table of contents (sidebar on desktop, tabs on mobile) so each view is still one click away.

## 5. Why I think this is the right approach

- **Correctness over convenience where it changes the answer.** Kaplan–Meier instead of naive retention, hazard-based lifetime instead of "average tenure of leavers", and the per-month ads comparison instead of the naive one. In each case the simple version gives a materially different, misleading answer on this data.
- **Every threshold is either derived or validated.** Onboarding thresholds come from the historic distribution, the lead threshold comes from the backtest, and everything else is a named constant in one place, ready to tune.
- **One join, pure metrics, tests.** Definitions can't drift between views, and every metric is pinned by unit tests that run without a database.
- **Missing data stays missing,** small groups make no claims, and excluded rows are reported.

**What I'd do next with more time:** calibrate the health score into a churn probability and sort by expected MRR lost; turn the lead-drop rule into a weekly alert; and get leads at a finer grain than monthly so the warning can fire earlier.

## 6. Time and use of AI

- **Time:** 4 hours, roughly following the timebox in [PLAN.md](PLAN.md): data exploration first, then the sync and the join, metric definitions, the calculation backend, the UI, the bonus, and documentation. Once the required views worked, the remaining time went into iteration: rerunning the backtest changed the live lead rule, and the layout got a second pass for visual hierarchy, mobile and dark mode.
- **AI** was used for speed (scaffolding, boilerplate, refactoring, styling) under the rules in [CONVENTIONS.md](CONVENTIONS.md). The metric definitions, thresholds, and the decision to backtest the lead rule were mine, and I can explain each of them.
