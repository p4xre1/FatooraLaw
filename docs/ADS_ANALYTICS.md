# Ads reporting: current approach and safe roadmap

## What exists now

The **Livraisons** module accepts a Meta (Facebook/Instagram) or Google Ads CSV export. It groups daily rows by campaign and saves the campaign name plus aggregate totals: date range, spend, impressions, clicks, conversions and conversion value. The dashboard derives CTR, CPC, CPA, click-to-conversion rate and ROAS; existing manually tracked leads, verified buyers and CAC remain available alongside these platform-reported figures.

The importer reads selected aggregate columns only. It does not retain the source file, account IDs, access tokens, ad-level identifiers, user-level records or arbitrary extra columns. Because campaign names are user-defined, review them in the preview and remove anything you consider sensitive before saving. CSV parsing runs in the browser; the selected file is limited to 5 MB. Imported aggregates are saved with the existing campaign records in the account-partitioned browser `localStorage`, **not** in Supabase. This inherits the app's prototype limitation: local data is device/browser-specific and should not yet be treated as a durable production financial ledger.

## Important interpretation

- Platform-reported conversions and conversion value are not necessarily sales, paid invoices or verified clients. Attribution windows, view-through attribution, modeled conversions, refunds and currency/time-zone settings can differ by platform.
- Reported ROAS is `platform conversion value ÷ platform spend`; it is not net profit. The order ledger's collected cash/profit and verified-client CAC answer different questions.
- CTR is clicks ÷ impressions; CPC is spend ÷ clicks; CPA is spend ÷ reported conversions. Zero denominators display as unavailable.
- Daily report rows are consolidated by campaign name. Separate date slices with the same campaign name are combined; importing overlapping exports again will duplicate/add their totals. Export a non-overlapping period and avoid re-importing it until deduplication by source, campaign ID and reporting period is implemented.
- The current importer is intentionally a useful first step, not a claim that every vendor CSV schema is supported. Check the preview and compare totals against the platform before saving.

## Recommendation before native account connections

Start with explicit report imports and a clear source-period record. It is safer and much faster to validate with real customer exports than to immediately request broad Meta/Google access. Next, add reversible imports (stable campaign/source/period keys, update-or-replace behavior), normalized currency and account timezone, monthly trends, and an exportable reconciliation report.

Only then consider a server-side OAuth connector. Keep client secrets and refresh/access tokens in a server-side secret store, never `VITE_*`, browser storage, logs, or the client bundle. Use minimum scopes, short-lived access, encryption at rest, rotation/revocation, per-tenant authorization and audit events. Fetch only aggregate campaign/day metrics; do not ingest audience members, emails, phone numbers, click IDs or other user-level data. Document retention/deletion and obtain the required platform permissions and user consent. Native APIs need a trusted backend and a production data store before this prototype can safely support persistent connections.

## Useful next metrics

1. Paid-media spend, impressions, clicks and platform conversions by day/campaign.
2. Verified lead conversion, delivered orders, collected revenue and refund/return rates from Fatorati's own workflow.
3. Reconciled CAC per verified/delivered/paid customer; label the chosen denominator explicitly.
4. Spend-to-collected-revenue ratio and contribution margin after product, delivery, packaging and ad cost. Never label platform ROAS as profit.
5. Compare platform conversion totals with CRM/order totals while preserving the two sources separately.
