# Analytics rebuild — delivery report

Date: 2026-11-26
Project: Jadhav Engineering Plate Weight Calculator
Scope: section Analytics Pages, Main Analytics Dashboard, share links with
server-side expiry, view and advertisement-click accuracy.

Screenshots in this folder:

| Before | After |
| --- | --- |
| `before/a-section.png` | `after/a-section.png` |
| `before/a-section-mobile.png` | `after/a-section-mobile.png` |
| `before/main-dashboard.png` | `after/main-dashboard.png` |
| `before/main-dashboard-mobile.png` | `after/main-dashboard-mobile.png` |
| `before/share-modal.png` | `after/share-modal.png` |
| `before/shared-valid.png` | `after/shared-valid.png` |
| — | `after/chart-tooltip.png` |
| — | `after/share-expired.png` |

The "before" images were captured from the pages as they were at the start of
this work; they are the evidence of the old layout, not a re-run. The project is
not a git repository, so the old pages cannot be regenerated for a second
capture.

---

## 1. Analytics pages rebuilt

| Page | File | Status |
| --- | --- | --- |
| A Section Analytics | `frontend/analytics/a-row/index.html` | rebuilt |
| B Section Analytics | `frontend/analytics/b-row/index.html` | rebuilt |
| C Section Analytics | `frontend/analytics/c-row/index.html` | rebuilt |
| D Section Analytics | `frontend/analytics/d-row/index.html` | rebuilt |
| E Section Analytics | `frontend/analytics/e-row/index.html` | rebuilt |
| F Section Analytics | `frontend/analytics/f-row/index.html` | rebuilt |
| Main Analytics Dashboard | `frontend/analytics/index.html` | rebuilt |
| Shared (read-only) report | `frontend/analytics/share/index.html` | rebuilt |

Shared code, replacing three duplicated SVG chart renderers and two duplicated
card/table builders:

| File | Role |
| --- | --- |
| `frontend/analytics/chart.js` | one chart: area fill, dashed grid, round axis ticks, pointer tooltip + guide line, bucketing above 160 points, redraw on container resize |
| `frontend/analytics/shared.js` | formatting, `statCard`, `calculatorCard`, `trendPill`, API helpers, key storage |
| `frontend/analytics/analytics.js` | section page renderer, date presets, share modal, copy, revoke |
| `frontend/analytics/overview.js` | main dashboard: totals, graph, table, section filter, name search |
| `frontend/analytics/share/share.js` | shared report renderer, expired/revoked state |
| `frontend/analytics/analytics.css` | layout, cards, table, modal, mobile rules |
| `tools/build_analytics.py` | regenerates all 8 pages, tracker tags on 250 pages, service-worker precache |

Removed from the pages: the campaign cost/reach/engagement panels, the
date-wise raw table, the per-section "campaign filter", the eight-card master
summary and the separate Row comparison table. What is left is the calculator
name, its views, its advertisement clicks, one trend per metric, one graph per
page, the date presets and Share.

## 2. Calculators identified (24 in 6 sections)

| Section | Calculators |
| --- | --- |
| A | Plate, C Channel, Solid Round Bar, Square Bar |
| B | Circular Plate, E-Section, Round Bar with Hexagonal Hole, Triangular Bar |
| C | Flange Plate Weight Calculator, T Channel, Trapezium Bar, Hexagonal Bar with Round Hole |
| D | Sphere / Ball, Pipe, Trapezoidal Bar, Solid Cone |
| E | L Channel, Shell, Box Channel, Truncated Cone (Conical Reducer) |
| F | I Channel, Dish Ends Calculator, Hexagon Bar, Nut & Bolt Weight Calculator |

Every one appears as its own card on its section page and its own row on the
main dashboard, with its own views and its own advertisement clicks.

## 3. Data model changes

No new database or hosted service. The existing zero-dependency store is kept:
one append-only NDJSON file per UTC day in `ANALYTICS_DATA_DIR`, plus
`shares.json` next to it.

| Change | Detail |
| --- | --- |
| Section labels | `sectionLabel()` turns the internal row id/title (`a-row`, `A-Row`) into the display name `A Section`. `rowTitle: "A-Row"` is still returned so the advertisement system keeps its own names |
| Daily series | `dailySeries(from, to)` zero-fills every day of the range (a quiet day is `0`, not a gap), drops leading days before the first stored event for "all time", keeps trailing days up to today |
| Per-metric trends | calculators now carry `viewsTrend` and `adClicksTrend` separately, each computed against the immediately preceding range of the same length |
| Share records | `{ tokenHash, rowId, createdAt, expiresAt, revoked }`, token stored only as SHA-256 |
| Access control | new `ANALYTICS_KEY` (falls back to `API_KEY`) and `ANALYTICS_PUBLIC` |

## 4. Backend / API changes

| Endpoint | Change |
| --- | --- |
| `POST /api/analytics/collect` | unchanged contract, still public (beacon) |
| `GET /api/analytics/overview` | key-protected; sections and calculators carry trends, zero-filled daily series |
| `GET /api/analytics/rows/:row` | key-protected; `section.title` is now "A Section" |
| `POST /api/analytics/shares` | key-protected; `rowId` + `ttlMs`, only 5 m / 10 m / 1 h / 7 d / 30 d accepted |
| `GET /api/analytics/shares/:token` | token only; server-clock expiry; `410` expired/revoked, `404` unknown |
| `DELETE /api/analytics/shares/:token` | key-protected revoke; `200`, then the link answers `410` |

`analyticsAccess()` returns `ok` / `unauthorized` / `unconfigured`;
`keyMatches()` compares with `crypto.timingSafeEqual`. All report responses send
`Cache-Control: no-store`.

Fail-closed behaviour is deliberate: with no key configured, reports answer
`503 analytics_locked` instead of quietly serving the site's analytics to
anyone. `ANALYTICS_PUBLIC=true` is the explicit opt-out for an owner who wants
public dashboards.

## 5. View tracking

Existing tracker kept and not duplicated (`frontend/shared/analytics-tracker.js`):

* A view is one loaded calculator page, recorded once per device + calculator
  per 30 minutes (client window plus server-side dedupe), with a unique
  `eventInstanceId` so a beacon delivered twice is stored once.
* Views are attributed to the canonical slug and section from
  `row-ads.config.js`, so `/es/calculators/plate/` and
  `/frontend/calculators/plate/` are the same calculator.
* Dashboard visits never produce a calculator view; the analytics pages do not
  include the tracker.

Measured on a real page served through the same-origin proxy
(`.tmp/an-tracking.mjs`): first load `+1` view for `plate`, immediate reload
`+0`, no other calculator changed. A unique-visitor number is **not** shown:
the device hash exists only for deduplication, and the pages therefore label
these figures "Total Views", never "unique people".

## 6. Advertisement click tracking

* The click is captured in the document capture phase on
  `[data-mw-row-ad] a`, before navigation, and never prevents the destination
  from opening.
* The event records the section, the calculator whose advertisement was
  clicked, the campaign id when the banner has one, and the server timestamp.
* Clicks are per activation (two clicks count twice); impressions and views are
  the deduplicated ones, so a page view can never become a click.
* The count is labelled "Advertisement Clicks" (events), not people.

Measured: one click on the Plate page advertisement added exactly `+1` click to
`plate` and changed no other calculator in any section (`otherCalculatorsChanged: []`).

## 7. Graphs and trends

* One renderer (`chart.js`) for section pages, main dashboard and shared links:
  30-day view spans the card exactly (the viewBox follows the container, no
  letterboxing), axis ticks are whole steps (0/10/20/30/40/50), dates along the
  bottom, counts up the side.
* Pointer hover shows a tooltip with the date and both values and a guide line;
  verified in the browser ("Nov 12 · Views 40 · Clicks 17").
* Views are a filled teal line, advertisement clicks an orange line; the legend
  names them.
* Trends: `up` / `down` / `flat` per metric, compared with the immediately
  preceding range of equal length from real events (±2% counts as flat). A
  neutral `— Stable` pill appears for calculators without movement (for example
  Circular Plate).
* Date presets — Last 7 days (rolling), Last 30 days (rolling), Last month
  (previous calendar month: 1st to last day), All time — change the cards, the
  graph and (on the dashboard) the table from one request each.

## 8. Share links with server-side expiry

Workflow: section page → **Share** → modal "Share Analytics" / "Create a
temporary shareable link to this Analytics Page." → expiry (5 Minutes,
10 Minutes, 1 Hour, 1 Week, 1 Month) → **Create Share Link** → URL + **Copy
Link** + **Revoke Link**.

* Tokens are 32 random bytes from `crypto.randomBytes`, base64url (43 chars).
  Only the SHA-256 hash is stored, so the file itself cannot be replayed.
* Every `GET` re-reads the record and compares `expiresAt` with the server
  clock. Nothing in the browser can extend a link.
* Expired or revoked → `410` and the clean "This Share Link Has Expired" page,
  with no data, no section navigation and no share controls; it does not
  redirect to the private dashboards. Unknown/malformed token → `404`.
* The shared page is read-only and scoped to its token's section only; it can
  still switch date ranges (the API recomputes the same section for those
  dates). Shared pages send `Referrer-Policy: no-referrer`.

Tests run:

| Test | Result |
| --- | --- |
| 5-minute link works | `200` |
| `expiresAt` moved into the past, API restarted | `410` `expired` |
| Same URL refreshed | `410` |
| Same token with a different date range | `410` |
| Link revoked from the modal | result hidden, message shown, link `410` |
| All five TTLs accepted | `201` × 5 |
| Invalid TTL (`60000`) | `400` |
| Unknown token | `404` |
| Token length / charset | 43 chars, url-safe |
| Shared page DOM | 2 summary cards, 4 calculator cards, matching numbers, no share button, no section nav |

The short TTLs were tested by moving the stored `expiresAt` into the past rather
than waiting, so the same server-side check is exercised in seconds.

## 9. Main dashboard

* Totals for the whole site: 2,354 calculator views, 508 advertisement clicks
  for 2026-10-28…2026-11-26 (current data), drawn from the same events as the
  section pages.
* Combined graph of both series for the same range.
* One table with Section / Calculator / Views / Clicks / Trend for all 24
  calculators.
* Section filter above the graph: cards, graph, scope line and table all switch
  to that section (A Section → 1,167 views, 496 clicks, 4 rows, 30-point
  section series), using the section's own report over the identical range so
  the numbers reconcile by construction.
* Name search filters the table (search "round" → 3 rows).
* Every calculator appears exactly once; the overview, its section sums and its
  calculator sums are equal in the API test.

## 10. Security test results

| Check | Result |
| --- | --- |
| Report without key | `401` |
| Report with correct key | `200` |
| Server with no key at all | `503 analytics_locked` |
| Collection still works when reports are locked | `204` |
| Share creation without key | `401` |
| Revoke without key / with key | `401` / `200`, then `410` |
| Unknown or malformed token | `404` |
| Shared payload scope | only the token's section |
| Reports | `Cache-Control: no-store` |
| Token storage | SHA-256 hash only, 43-char random token |
| Key comparison | `crypto.timingSafeEqual` |
| Admin credentials in public pages | none (key kept in `sessionStorage` per session) |

## 11. Mobile and desktop results

| Width | Result |
| --- | --- |
| 1280 px | full layout, 4 calculator cards per section, 24-row table, no horizontal overflow |
| 820 px (tablet) | no horizontal overflow, cards reflow to a single column block, table still readable |
| 390 px (mobile) | summary cards stack, date presets scroll as one row, chart fills the card (4 x-labels), calculator table becomes one block per calculator (name, section, views, clicks, trend), share modal fits, copy and revoke reachable, horizontal overflow `0` |

No console errors on any page at any tested width.

## 12. Before / after

Before (from `before/`): section page with "A-Row" naming, no per-calculator
trends, axis labels 13/25/38, campaign and date-wise panels, and a dashboard
whose section filter changed the table but left the summary cards at the site
totals (2,353 / 507) and the chart at all 6 sections.

After (from `after/`): "A Section" naming everywhere, one card per calculator
with its own views, clicks and trend pills, a chart that fills its card with
round ticks and a working tooltip, the section filter driving cards + graph +
table (1,167 / 496, 4 rows, section-only series), a share modal with revoke, a
read-only shared page and the expired-link page.

## 13. Limitations and unfinished items

1. **Analytics needs the Node API.** The website is static; views, reports and
   share links live in `backend/`. On a static-only host the pages say the API
   is not reachable instead of showing numbers. Secure server-side expiry cannot
   exist without it.
2. **Single-process store.** The NDJSON store is read into memory per process.
   Running several API instances needs a shared database behind the same
   interface; nothing in the pages would change.
3. **No unique-visitor metric is displayed.** The device id is hashed and used
   only to deduplicate views and impressions. The pages never call counts
   "unique people".
4. **No bot filtering beyond deduplication.** Collection is rate limited per IP;
   there is no CAPTCHA or user-agent filtering, so automated traffic is counted
   like any other view.
5. **Campaign cost data is no longer shown.** `campaigns.json` and the payload
   fields remain for reporting scripts, but the redesigned pages do not display
   cost, reach or engagement.
6. **The screenshots and test numbers come from a seeded development dataset**
   (`.tmp/an-data`, 6,703 events over 75 days). It is not production data and
   must not be deployed; a production deployment starts from real events and
   its charts fill in as visits arrive.
7. **Not tested by a human on a physical phone or Safari.** Mobile and tablet
   checks were headless Chromium at 390 / 820 / 1280 px.
8. **The report does not include a before/after comparison of the expired-link
   page**, because the old build had no expired state at all.

## Test commands and results

```
node .tmp/an-api-test.mjs      → {"checks":57,"failures":0, sections:6, calculators:24}
node .tmp/an-contract.mjs      → {"checks":16,"failures":0}
node .tmp/an-browser.mjs --shots after
                               → tooltip ok, share 5 TTLs, revoke 410, expired page,
                                 shared read-only, filter 4 rows / 62 chart circles,
                                 mobile overflow 0, console errors []
node .tmp/an-browser.mjs --tablet
                               → 820 px: overflow -15, 4 calculators, 24 rows, no errors
node .tmp/an-tracking.mjs      → first load +1 view, reload +0, ad click +1 on plate only
cd backend && npm test         → 71 calculator pairs PASS, thread factors PASS, densities PASS
```

Raw results are kept in `.tmp/verify/` (`an-api.json`, `an-contract.json`,
`an-browser-after.json`, `an-browser-before.json`, `an-browser-tablet.json`) and
the screenshots in `docs/analytics-audit/{before,after}/`.
