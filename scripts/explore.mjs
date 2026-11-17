// Data-quality exploration over data/snapshot (written by `npm run sync`).
// Findings are summarised in DATA_NOTES.md.
import { readFileSync } from 'node:fs';

const load = (n) => JSON.parse(readFileSync(new URL(`../data/snapshot/${n}.json`, import.meta.url)));
const { customers, subscriptions: subs, invoices } = load('billing');
const { clients, tickets, leads } = load('product');

const count = (arr, f) => arr.reduce((m, x) => { const k = String(f(x)); m[k] = (m[k] || 0) + 1; return m; }, {});
const h = (t) => console.log(`\n### ${t}`);
const d = (s) => new Date(s * 1000).toISOString().slice(0, 10);

h('Clients');
console.log('status', count(clients, (c) => c.status));
console.log('trade', count(clients, (c) => JSON.stringify(c.trade)));
console.log('region', count(clients, (c) => c.region));
console.log('ads.enabled', count(clients, (c) => c.ads?.enabled));
console.log('ads shape variants', count(clients, (c) => (c.ads === null ? 'null' : Object.keys(c.ads).join(','))));
console.log('stripe id null', clients.filter((c) => !c.stripe_customer_id).length);
console.log('last_login null', clients.filter((c) => !c.last_login_at).length);
console.log('onboarding keys', count(clients, (c) => Object.entries(c.onboarding || {}).filter(([, v]) => v).map(([k]) => k).join(',') || 'none'));
console.log('status x live_at', count(clients, (c) => `${c.status}|live:${!!c.onboarding?.live_at}`));
const dupStripe = count(clients.filter((c) => c.stripe_customer_id), (c) => c.stripe_customer_id);
console.log('dup stripe ids in clients', Object.entries(dupStripe).filter(([, v]) => v > 1));
const dupNames = count(clients, (c) => c.business_name.toLowerCase().trim());
console.log('dup business names', Object.entries(dupNames).filter(([, v]) => v > 1));
console.log('signup range', clients.map((c) => c.signup_at).sort()[0], clients.map((c) => c.signup_at).sort().at(-1));

h('Join clients <-> customers');
const custById = new Map(customers.map((c) => [c.id, c]));
const unmatchedClients = clients.filter((c) => c.stripe_customer_id && !custById.has(c.stripe_customer_id));
console.log('clients with stripe id not in billing', unmatchedClients.map((c) => [c.id, c.stripe_customer_id, c.business_name]));
const clientStripe = new Set(clients.map((c) => c.stripe_customer_id));
console.log('customers without client', customers.filter((c) => !clientStripe.has(c.id)).map((c) => [c.id, c.name, c.email]));
const nameMismatch = clients.filter((c) => custById.has(c.stripe_customer_id) && custById.get(c.stripe_customer_id).name !== c.business_name);
console.log('name mismatch', nameMismatch.length, nameMismatch.slice(0, 5).map((c) => [c.business_name, custById.get(c.stripe_customer_id).name]));
console.log('customer delinquent', count(customers, (c) => c.delinquent));
console.log('dup customer emails', Object.entries(count(customers, (c) => c.email)).filter(([, v]) => v > 1));

h('Subscriptions');
console.log('status', count(subs, (s) => s.status));
console.log('subs per customer', count(Object.values(count(subs, (s) => s.customer)), (x) => x));
console.log('items combos', count(subs, (s) => s.items.data.map((i) => i.price.nickname).join(' + ')));
console.log('base price amounts', count(subs.flatMap((s) => s.items.data.filter((i) => !i.price.id.includes('ads'))), (i) => `${i.price.id}:${i.price.unit_amount}`));
console.log('ads price amounts', count(subs.flatMap((s) => s.items.data.filter((i) => i.price.id.includes('ads'))), (i) => `${i.price.id}:${i.price.unit_amount}`));
console.log('quantity', count(subs.flatMap((s) => s.items.data), (i) => i.quantity));
console.log('interval', count(subs.flatMap((s) => s.items.data), (i) => `${i.price.recurring?.interval}/${i.price.recurring?.interval_count}`));
console.log('cancel reason', count(subs.filter((s) => s.status === 'canceled'), (s) => s.cancellation_details?.reason));
console.log('cancel feedback', count(subs.filter((s) => s.status === 'canceled'), (s) => s.cancellation_details?.feedback));
console.log('canceled_at vs ended_at differ', subs.filter((s) => s.canceled_at && s.canceled_at !== s.ended_at).length);
console.log('start != created', subs.filter((s) => s.start_date !== s.created).length);
console.log('canceled without canceled_at', subs.filter((s) => s.status === 'canceled' && !s.canceled_at).length);
console.log('subscription keys', count(subs, (s) => Object.keys(s).sort().join(',')));

h('Status consistency product vs billing');
const subByCust = new Map(subs.map((s) => [s.customer, s]));
console.log(count(clients, (c) => `${c.status} | ${subByCust.get(c.stripe_customer_id)?.status ?? 'NO_SUB'}`));

h('Ads consistency product vs billing');
const hasAdsItem = (s) => !!s?.items.data.some((i) => i.price.id.includes('ads'));
console.log(count(clients, (c) => `product:${c.ads?.enabled} billing:${hasAdsItem(subByCust.get(c.stripe_customer_id))}`));

h('Invoices');
console.log('status', count(invoices, (i) => i.status));
console.log('billing_reason', count(invoices, (i) => i.billing_reason));
console.log('attempt_count', count(invoices, (i) => i.attempt_count));
console.log('refunds >0', invoices.filter((i) => i.post_payment_credit_notes_amount > 0).length);
console.log('paid < due (paid status)', invoices.filter((i) => i.status === 'paid' && i.amount_paid < i.amount_due).length);
console.log('amount_due values', count(invoices, (i) => i.amount_due));
console.log('currency', count(invoices, (i) => i.currency));
console.log('no subscription', invoices.filter((i) => !i.subscription).length);
console.log('invoice customer not in customers', invoices.filter((i) => !custById.has(i.customer)).length);
console.log('open invoices', invoices.filter((i) => i.status === 'open').map((i) => [i.customer, d(i.created), i.attempt_count, i.next_payment_attempt && d(i.next_payment_attempt)]).slice(0, 15));
console.log('created range', d(Math.min(...invoices.map((i) => i.created))), d(Math.max(...invoices.map((i) => i.created))));

h('Tickets');
console.log('category', count(tickets, (t) => t.category));
console.log('status', count(tickets, (t) => t.status));
const clientIds = new Set(clients.map((c) => c.id));
console.log('ticket client not found', tickets.filter((t) => !clientIds.has(t.client_id)).length);
console.log('tickets per client dist', count(Object.values(count(tickets, (t) => t.client_id)), (x) => x));

h('Leads');
const lv = Object.entries(leads);
console.log('empty lead lists by status', count(lv.filter(([, l]) => l.length === 0), ([id]) => clients.find((c) => c.id === id).status));
console.log('months count dist', count(lv, ([, l]) => l.length));
const all = lv.flatMap(([, l]) => l);
console.log('leads null/negative', all.filter((x) => x.leads == null || x.leads < 0).length, all.filter((x) => x.leads == null).slice(0, 3));
console.log('month range', all.map((x) => x.month).sort()[0], all.map((x) => x.month).sort().at(-1));
let gaps = 0, dupM = 0, beforeLive = 0, afterCancel = 0;
for (const [id, l] of lv) {
  const c = clients.find((x) => x.id === id);
  const ms = l.map((x) => x.month);
  if (new Set(ms).size !== ms.length) dupM++;
  const sorted = [...ms].sort();
  for (let i = 1; i < sorted.length; i++) {
    const [y1, m1] = sorted[i - 1].split('-').map(Number); const [y2, m2] = sorted[i].split('-').map(Number);
    if ((y2 * 12 + m2) - (y1 * 12 + m1) !== 1) { gaps++; break; }
  }
  if (c.onboarding?.live_at && sorted[0] < c.onboarding.live_at.slice(0, 7)) beforeLive++;
  const s = subByCust.get(c.stripe_customer_id);
  if (s?.canceled_at && sorted.at(-1) > d(s.canceled_at).slice(0, 7)) afterCancel++;
}
console.log({ gaps, dupM, beforeLive, afterCancel });
console.log('Nov-2026 rows', all.filter((x) => x.month === '2026-11').length);
console.log('leads value dist (bucket)', count(all, (x) => (x.leads === 0 ? '0' : x.leads < 5 ? '1-4' : x.leads < 15 ? '5-14' : x.leads < 30 ? '15-29' : '30+')));
