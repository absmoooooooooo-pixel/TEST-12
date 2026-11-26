# Analytics

First-party analytics for the calculator website: one dashboard per section, one
combined dashboard for the whole site, and temporary read-only share links.

Every number comes from tracked events stored by the API in `backend/`. Nothing
is estimated, seeded or hard-coded, and the section pages, the combined
dashboard and a shared link all read the same records through the same report
functions, so their totals reconcile for the same dates.

```
frontend/analytics/index.html            main dashboard (all sections, generated)
frontend/analytics/a-row/index.html      A Section dashboard (generated, … f-row)
frontend/analytics/share/index.html      read-only shared report (opened by token)
frontend/analytics/analytics.css         shared layout, cards, table, modal
frontend/analytics/shared.js             formatting, cards, trend pills, API helpers
frontend/analytics/chart.js              the one SVG chart renderer (tooltip, resize)
frontend/analytics/analytics.js          section page renderer + share modal
frontend/analytics/overview.js           main dashboard renderer
frontend/analytics/share/share.js        shared report renderer
frontend/shared/analytics-tracker.js     records views, impressions, ad clicks
backend/analytics/store.js               event store (one NDJSON file per UTC day)
backend/analytics/shares.js              share tokens, expiry, revocation
backend/analytics/rows.json              canonical section/calculator manifest
backend/controllers/analyticsController.js  reports, shares, ingestion
tools/build_analytics.py                 regenerates the pages and the wiring
```

## 1. What a view and a click mean

| Event | Recorded when | Duplicate protection |
| --- | --- | --- |
| `calculator_view` | a calculator page has loaded | once per device + calculator per 30 min, plus a unique `eventInstanceId` |
| `ad_click` | the advertisement link for that calculator is activated | one record per `eventInstanceId` |
| `ad_impression` | the advertisement is actually mounted | once per device + section + campaign per 30 min |
| `calculator_click` | a calculator card on a home page is activated | one record per `eventInstanceId` |

The server enforces the same rules, so a beacon delivered twice is stored once.
A reload does not add a view; opening the page again after the window does. An
analytics dashboard visit is never stored as a calculator view. Advertisement
clicks are counted per activation and are always attached to the calculator
whose advertisement was clicked, so one calculator's clicks never leak into
another's.

Every event is attributed to the canonical slug and section from
`row-ads.config.js`, never to a language copy: a Spanish Plate page reports
`calculator: "plate"`, `row: "a-row"`, `locale: "es"`.

## 2. Pages

| Page | URL | Shows |
| --- | --- | --- |
| Main dashboard | `/frontend/analytics/` | site totals, combined graph, every calculator in one table, section filter, name search |
| Section dashboards | `/frontend/analytics/{a..f}-row/` | that section's totals, its graph, one card per calculator |
| Shared report | `/frontend/analytics/share/?token=…` | one section, read-only, while the token is valid |

Each section page shows only its own calculators — four views on a section page
are four separate numbers, never one combined figure. Each calculator card
carries its own views, its own advertisement clicks and a trend pill.

Date ranges (every page and every shared link): **Last 7 days** (rolling),
**Last 30 days** (rolling), **Last month** (the previous calendar month, day 1
to its last day) and **All time**. Cards and graph always change together.

Trends compare the selected range with the immediately preceding range of the
same length, using stored events. `viewsTrend` and `adClicksTrend` are computed
per calculator and per section by the API; `direction` is `up`, `down` or
`flat` (within ±2%, or no previous activity to compare with).

The `daily` series is zero-filled for every day in the range, so a quiet day is
a zero and not a gap. For "all time" the series starts at the first stored event
and ends today.

## 3. Share links

A section page has a **Share** button. The modal offers exactly 5 Minutes,
10 Minutes, 1 Hour, 1 Week and 1 Month, creates the link and shows it with a
Copy Link button and a Revoke Link button.

* The token is 32 cryptographically random bytes, base64url-encoded (43
  characters). Guessing one is not practical and the API answers 404 for an
  unknown token, so tokens cannot be enumerated.
* Only a SHA-256 hash of the token is stored (`shares.json` next to the event
  data), together with the section id, `createdAt`, `expiresAt` and a `revoked`
  flag.
* `GET /api/analytics/shares/:token` re-reads that record on every request and
  compares `expiresAt` with the **server clock**. A browser cannot extend a
  link by changing storage, clocks or the URL; refreshing, another browser and
  a copied URL all reach the same server check.
* Expired and revoked links return `410` with `error.code` `expired` /
  `revoked`; the page then shows "This Share Link Has Expired" and no data, no
  navigation and no share controls. It never redirects to the private
  dashboards.
* A shared link is read-only: it exposes one section's report for the token's
  own dates, and nothing else. It cannot create, revoke or list links.
* `DELETE /api/analytics/shares/:token` revokes a link immediately (`200`), and
  the owner needs the analytics key to do it. Revoking is the way to take a
  link down before it expires.
* Shared pages send `Referrer-Policy: no-referrer` so the token does not leak to
  other sites.

## 4. Access control

Private reports and share management need the analytics key:

| Variable | Purpose |
| --- | --- |
| `ANALYTICS_KEY` | the key the dashboards ask for. Falls back to `API_KEY` when empty |
| `ANALYTICS_PUBLIC` | `true` publishes the reports deliberately on a server with **no** key |

With a key set, a request without `x-api-key` (or `?key=`) gets `401`. With no
key and `ANALYTICS_PUBLIC` not `true`, the reports answer `503`
`analytics_locked` — an unconfigured server never hands site analytics to the
internet. Collection (`POST /api/analytics/collect`) stays public: it is the
beacon a public page must be able to send.

The dashboard asks for the key once per browser session and keeps it in
`sessionStorage` (never in the URL, never in a file). The key is compared with
`crypto.timingSafeEqual`.

## 5. API

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/analytics/collect` | public | record one event (beacon, rate limited) |
| `GET` | `/api/analytics/overview` | key | combined report for every section |
| `GET` | `/api/analytics/rows/:row` | key | report for one section |
| `POST` | `/api/analytics/shares` | key | create a share link (`rowId`, `ttlMs`) |
| `GET` | `/api/analytics/shares/:token` | token | read-only report for that section |
| `DELETE` | `/api/analytics/shares/:token` | key | revoke a share link |

Report parameters: `from`, `to` (`YYYY-MM-DD`, default the last 30 days, at most
366 days). A section report contains `section`, `summary`, `calculators`
(with `views`, `adClicks`, `viewsTrend`, `adClicksTrend`) and `daily`. The
overview adds `sections` and a flat `calculators` list across all sections.
Reports are sent with `Cache-Control: no-store`.

`ttlMs` must be one of 300000, 600000, 3600000, 604800000 or 2592000000;
anything else is `400`.

## 6. Deploying

1. Deploy `backend/` (Node 18+, no dependencies).
2. Set `ANALYTICS_KEY` to a long random value (this is what the dashboards ask
   for), plus `ALLOWED_ORIGINS` for the site origin.
3. Point the site at the API in `frontend/assets/js/api-config.js`:

   ```js
   window.MW_API_BASE = "https://api.example.com";
   ```

   With it empty, requests go to the site's own origin; a static host answers
   404 and the pages say the API is not reachable instead of showing numbers.

Events live in `ANALYTICS_DATA_DIR` (default `backend/analytics/data`) and share
tokens in `shares.json` next to it. Both are git-ignored and must be backed up
with the deployment data.

## 7. Regenerating pages

Sections and their calculators come from
`Material Weight Calculator on Language Ads/row-ads.config.js`. After changing
it:

```bash
python tools/build_analytics.py
```

That rewrites `backend/analytics/rows.json`, the six section pages, the main
dashboard, the tracker tags on every page and the service-worker precache.
Restart the API after regenerating `rows.json`.

## 8. Privacy and limits

* No IP address is stored. The random first-party device id is stored only as a
  SHA-256 hash, and only to deduplicate views and impressions.
* Event timestamps use the server clock in UTC; browser clocks are ignored.
* The store is one append-only NDJSON file per UTC day, read into memory at
  start. It fits a single API process; for several instances, replace
  `store.js` internals with a shared database and keep the interface.
* `backend/analytics/campaigns.json` (verified cost/reach figures) is still
  returned by the API for reporting scripts, but the redesigned pages no longer
  display campaign cost, reach or engagement.
