# -*- coding: utf-8 -*-
"""Builds the Analytics system (section dashboards + main dashboard).

Safe to run repeatedly:
  1. Reads canonical row structure from row-ads.config.js.
  2. Writes backend/analytics/rows.json.
  3. Generates frontend/analytics/index.html and per-row pages.
  4. Adds analytics tracker tags to home/calculator pages.
  5. Updates service-worker precache.

Run: python tools/build_analytics.py
"""

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADS_FOLDER = "Material Weight Calculator on Language Ads"
CONFIG_FILE = os.path.join(ROOT, ADS_FOLDER, "row-ads.config.js")
DASHBOARD_DATA = os.path.join(ROOT, "frontend", "assets", "data", "dashboard-data.js")
ROWS_MANIFEST = os.path.join(ROOT, "backend", "analytics", "rows.json")
DASHBOARD_DIR = os.path.join(ROOT, "frontend", "analytics")

TRACKER_TAG = '<script src="{rel}frontend/shared/analytics-tracker.js?v=1" defer></script>'
ADS_CONFIG_TAG = ('<script src="{rel}' + ADS_FOLDER + '/row-ads.config.js?v=2" defer></script>')
START_MARKER = "<!-- ROW ANALYTICS:START -->"
END_MARKER = "<!-- ROW ANALYTICS:END -->"


def read_text(path):
    with open(path, "r", encoding="utf-8", newline="") as handle:
        return handle.read()


def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)


def calculator_names():
    try:
        text = read_text(DASHBOARD_DATA)
        match = re.search(r"window\.ENGINEERING_DASHBOARD\s*=\s*(\{.*\});", text, re.S)
        if not match:
            return {}
        data = json.loads(match.group(1))
        return {tool["id"]: tool["name"] for tool in data.get("tools", []) if tool.get("id")}
    except Exception:
        return {}


def canonical_rows():
    text = read_text(CONFIG_FILE)
    rows_match = re.search(r"rows:\s*\[([^\]]*)\]", text)
    if not rows_match:
        raise SystemExit("Row list not found in " + CONFIG_FILE)
    rows = re.findall(r'"([a-z0-9-]+)"', rows_match.group(1))
    titles_match = re.search(r"rowTitles:\s*\{(.*?)\n    \},", text, re.S)
    titles = dict(re.findall(r'"([a-z0-9-]+)"\s*:\s*"([^"]*)"', titles_match.group(1))) if titles_match else {}
    calc_match = re.search(r"calculators:\s*\{(.*?)\n    \},", text, re.S)
    if not calc_match:
        raise SystemExit("Calculator map not found in " + CONFIG_FILE)
    calculators = {}
    for row in rows:
        entry = re.search(r'"' + re.escape(row) + r'"\s*:\s*\[([^\]]*)\]', calc_match.group(1))
        if not entry:
            raise SystemExit("Calculator list missing for " + row)
        calculators[row] = re.findall(r'"([^"]+)"', entry.group(1))
    return rows, titles, calculators


def build_manifest(rows, titles, calculators):
    names = calculator_names()
    return {
        "note": "Generated from " + ADS_FOLDER + "/row-ads.config.js.",
        "rows": [{
            "id": row,
            "title": titles.get(row, row.upper()),
            "calculators": [{"id": slug, "name": names.get(slug, slug.replace("-", " ").title())}
                            for slug in calculators[row]]
        } for row in rows]
    }


def section_label(row_id, title):
    # A-Row -> A Section, keep title fallback
    letter = row_id.replace("-row", "").upper()
    return letter + " Section"


def nav_html(rows, titles, current):
    items = [("../index.html", "Main Dashboard", current == "main")]
    for row in rows:
        items.append((f"../{row}/index.html", section_label(row, titles.get(row, row)), current == row))
    return "\n".join(
        f'      <a href="{href}"{" aria-current=\"page\"" if active else ""}>{label}</a>'
        for href, label, active in items
    )


def main_nav(rows, titles):
    items = [("./index.html", "Main Dashboard", True)]
    for row in rows:
        items.append((f"./{row}/index.html", section_label(row, titles.get(row, row)), False))
    return "\n".join(
        f'      <a href="{href}"{" aria-current=\"page\"" if active else ""}>{label}</a>'
        for href, label, active in items
    )


SECTION_PAGE = u"""<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{heading} | Jadhav Engineering</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#043d3b">
  <link rel="icon" href="../../../frontend/favicon.png" type="image/png">
  <link rel="stylesheet" href="../analytics.css?v=6">
</head>
<body data-analytics-row="{row}">
<header class="an-header">
  <div class="an-header__inner">
    <a class="an-brand" href="../../../index.html">
      <span class="an-brand__mark" aria-hidden="true">JE</span>
      <span class="an-brand__text">
        <strong>Jadhav Engineering</strong>
        <span>Analytics</span>
      </span>
    </a>
    <div class="an-title">
      <h1>{heading}</h1>
      <p>Calculator views, advertisement clicks, and performance trends</p>
    </div>
  </div>
  <div class="an-header__inner">
    <nav class="an-nav" aria-label="Analytics pages">
{nav}
    </nav>
  </div>
</header>
<main class="an-main">
  <div class="an-toolbar">
    <div class="an-range" id="anRange" role="group" aria-label="Date range">
      <button type="button" data-preset="7d" aria-pressed="false">Last 7 days</button>
      <button type="button" data-preset="30d" aria-pressed="true">Last 30 days</button>
      <button type="button" data-preset="last-month" aria-pressed="false">Last month</button>
      <button type="button" data-preset="all" aria-pressed="false">All time</button>
    </div>
    <div class="an-actions">
      <button type="button" class="an-btn an-btn--primary" id="anShareBtn">Share</button>
    </div>
  </div>
  <p class="an-status" id="anStatus" role="status" aria-live="polite"></p>
  <div class="an-message" id="anError" role="alert" hidden></div>
  <form class="an-unlock" id="anUnlock" hidden>
    <div class="an-field">
      <label for="anKey">Analytics key</label>
      <input type="password" id="anKey" autocomplete="off" spellcheck="false">
    </div>
    <button type="submit" class="an-btn an-btn--primary">Unlock report</button>
  </form>
  <div class="an-section-head">
    <h2>Performance Overview</h2>
    <p>Summary for this section</p>
  </div>
  <div class="an-cards" id="anSummary"></div>
  <section class="an-panel" aria-labelledby="anChartTitle">
    <div class="an-panel__head">
      <h2 id="anChartTitle">Performance Trend</h2>
      <p>Views and advertisement clicks over time</p>
    </div>
    <div class="an-chart" id="anChart"></div>
  </section>
  <div class="an-section-head">
    <h2>Calculator Performance</h2>
    <p>Each calculator tracked separately</p>
  </div>
  <section class="an-panel" aria-label="Calculator performance">
    <div class="an-calc-list" id="anCalculators"></div>
  </section>
  <p class="an-foot">Trends compare the selected period to the immediately preceding equivalent period.</p>
</main>
<div class="an-modal" id="shareModal" hidden>
  <div class="an-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="shareTitle" tabindex="-1">
    <div class="an-modal__head">
      <h2 id="shareTitle">Share Analytics</h2>
      <button type="button" class="an-modal__close" id="shareClose" aria-label="Close">&times;</button>
    </div>
    <p class="an-modal__desc">Create a temporary shareable link to this Analytics Page.</p>
    <div class="an-field">
      <label for="shareExpiry">Link Expiration</label>
      <select id="shareExpiry">
        <option value="300000">5 Minutes</option>
        <option value="600000">10 Minutes</option>
        <option value="3600000">1 Hour</option>
        <option value="604800000">1 Week</option>
        <option value="2592000000">1 Month</option>
      </select>
    </div>
    <button type="button" class="an-btn an-btn--primary" id="shareCreate">Create Share Link</button>
    <div class="an-share-result" id="shareResult" hidden>
      <div class="an-share-row">
        <input type="text" id="shareUrl" readonly aria-label="Share link">
        <button type="button" class="an-btn an-btn--ghost" id="shareCopy">Copy Link</button>
      </div>
      <button type="button" class="an-btn an-btn--danger" id="shareRevoke">Revoke Link</button>
    </div>
    <p class="an-share-msg" id="shareMsg" role="status" aria-live="polite"></p>
  </div>
</div>
<script src="../../assets/js/api-config.js"></script>
<script src="../shared.js?v=6" defer></script>
<script src="../chart.js?v=6" defer></script>
<script src="../analytics.js?v=6" defer></script>
</body>
</html>
"""

MAIN_PAGE = u"""<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Main Analytics Dashboard | Jadhav Engineering</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#043d3b">
  <link rel="icon" href="../../frontend/favicon.png" type="image/png">
  <link rel="stylesheet" href="./analytics.css?v=6">
</head>
<body>
<header class="an-header">
  <div class="an-header__inner">
    <a class="an-brand" href="../../index.html">
      <span class="an-brand__mark" aria-hidden="true">JE</span>
      <span class="an-brand__text">
        <strong>Jadhav Engineering</strong>
        <span>Analytics</span>
      </span>
    </a>
    <div class="an-title">
      <h1>Main Analytics Dashboard</h1>
      <p>Combined performance of every calculator across all sections</p>
    </div>
  </div>
  <div class="an-header__inner">
    <nav class="an-nav" aria-label="Analytics pages">
{nav}
    </nav>
  </div>
</header>
<main class="an-main">
  <div class="an-toolbar">
    <div class="an-range" id="ovRange" role="group" aria-label="Date range">
      <button type="button" data-preset="7d" aria-pressed="false">Last 7 days</button>
      <button type="button" data-preset="30d" aria-pressed="true">Last 30 days</button>
      <button type="button" data-preset="last-month" aria-pressed="false">Last month</button>
      <button type="button" data-preset="all" aria-pressed="false">All time</button>
    </div>
    <div class="an-actions an-actions--filter">
      <div class="an-field an-field--inline">
        <label for="ovSection">Section</label>
        <select id="ovSection"><option value="">All Sections</option></select>
      </div>
    </div>
  </div>
  <p class="an-status" id="ovStatus" role="status" aria-live="polite"></p>
  <div class="an-message" id="ovError" role="alert" hidden></div>
  <form class="an-unlock" id="ovUnlock" hidden>
    <div class="an-field">
      <label for="ovKey">Analytics key</label>
      <input type="password" id="ovKey" autocomplete="off" spellcheck="false">
    </div>
    <button type="submit" class="an-btn an-btn--primary">Unlock report</button>
  </form>
  <div class="an-section-head">
    <h2>Overall Performance</h2>
    <p id="ovHeadingNote">All sections combined</p>
  </div>
  <div class="an-cards" id="ovSummary"></div>
  <p class="an-scope" id="ovScope"></p>
  <section class="an-panel" aria-labelledby="ovChartTitle">
    <div class="an-panel__head">
      <h2 id="ovChartTitle">Performance Trend</h2>
      <p id="ovChartSub">Total views and advertisement clicks over time</p>
    </div>
    <div class="an-chart" id="ovChart"></div>
  </section>
  <section class="an-panel" aria-labelledby="ovTableTitle">
    <div class="an-panel__head">
      <h2 id="ovTableTitle">Calculator-Wise Performance</h2>
      <p>Every calculator across every section</p>
    </div>
    <div class="an-filters">
      <div class="an-field">
        <label for="ovSearch">Find calculator</label>
        <input type="search" id="ovSearch" placeholder="Search by calculator name">
      </div>
    </div>
    <div class="an-table-wrap">
      <table class="an-table">
        <thead>
          <tr>
            <th scope="col">Section</th>
            <th scope="col">Calculator Name</th>
            <th scope="col" class="is-number">Total Views</th>
            <th scope="col" class="is-number">Advertisement Clicks</th>
            <th scope="col">Trend</th>
          </tr>
        </thead>
        <tbody id="ovTableBody"></tbody>
      </table>
    </div>
    <p class="an-empty" id="ovTableEmpty" hidden>No calculators match the selected filters.</p>
  </section>
  <p class="an-foot">Data shown is based on tracked analytics events. Trends compare the selected period to the immediately preceding equivalent period.</p>
</main>
<script src="../assets/js/api-config.js"></script>
<script src="./shared.js?v=6" defer></script>
<script src="./chart.js?v=6" defer></script>
<script src="./overview.js?v=6" defer></script>
</body>
</html>
"""


def write_pages(rows, titles, calculators):
    for row in rows:
        heading = section_label(row, titles.get(row, row)) + " Analytics"
        html = SECTION_PAGE.format(heading=heading, row=row, nav=nav_html(rows, titles, row))
        write_text(os.path.join(DASHBOARD_DIR, row, "index.html"), html)
    write_text(os.path.join(DASHBOARD_DIR, "index.html"), MAIN_PAGE.format(nav=main_nav(rows, titles)))
    return len(rows)


def root_prefix(page):
    relative = os.path.relpath(ROOT, os.path.dirname(page)).replace(os.sep, "/")
    return "" if relative == "." else relative + "/"


def tracking_block(page):
    rel = root_prefix(page)
    lines = [START_MARKER]
    if os.path.basename(page) == "index.html" and "/calculators/" not in page.replace(os.sep, "/"):
        lines.append(ADS_CONFIG_TAG.format(rel=rel))
    lines.append(TRACKER_TAG.format(rel=rel))
    lines.append(END_MARKER)
    return "\n".join(lines)


def pages_to_wire():
    pages = []
    root_index = os.path.join(ROOT, "index.html")
    if os.path.isfile(root_index):
        pages.append(root_index)
    for entry in sorted(os.listdir(ROOT)):
        directory = os.path.join(ROOT, entry)
        if not os.path.isdir(directory):
            continue
        home = os.path.join(directory, "index.html")
        if os.path.isfile(home) and entry not in ("frontend", ADS_FOLDER):
            pages.append(home)
        calculators = os.path.join(directory, "calculators")
        if not os.path.isdir(calculators):
            continue
        for slug in sorted(os.listdir(calculators)):
            page = os.path.join(calculators, slug, "index.html")
            if os.path.isfile(page):
                pages.append(page)
    return pages


def wire_page(page):
    text = read_text(page)
    block = tracking_block(page)
    text = re.sub(re.escape(START_MARKER) + r".*?" + re.escape(END_MARKER) + r"\s*", "", text, flags=re.S)
    if "</body>" not in text:
        return False
    write_text(page, text.replace("</body>", block + "\n</body>", 1))
    return True


def wire_pages():
    pages = pages_to_wire()
    wired = sum(1 for page in pages if wire_page(page))
    return wired, len(pages)


PRECACHE_ADDITIONS = [
    "./frontend/shared/analytics-tracker.js?v=1",
    "./frontend/analytics/analytics.css?v=6",
    "./frontend/analytics/shared.js?v=6",
    "./frontend/analytics/chart.js?v=6",
    "./frontend/analytics/analytics.js?v=6",
    "./frontend/analytics/overview.js?v=6",
    "./frontend/analytics/share/index.html?v=6",
    "./frontend/analytics/share/share.js?v=6",
]
ANALYTICS_ENTRY = re.compile(r'^\./frontend/(?:shared/analytics-tracker\.js|analytics/(?:analytics\.css|shared\.js|chart\.js|analytics\.js|overview\.js|share/(?:index\.html|share\.js)))\?v=\d+$')


def update_service_worker():
    path = os.path.join(ROOT, "service-worker.js")
    text = read_text(path)
    match = re.search(r"var PRECACHE = \[(.*?)\n\];", text, re.S)
    if not match:
        return False
    entries = re.findall(r'"([^"]+)"', match.group(1))
    kept = [entry for entry in entries if not ANALYTICS_ENTRY.match(entry)]
    updated = kept + PRECACHE_ADDITIONS
    if updated == entries:
        return False
    listing = ",\n".join('    "%s"' % entry for entry in updated)
    text = text[:match.start()] + "var PRECACHE = [\n" + listing + "\n];" + text[match.end():]
    version = re.search(r'var CACHE_NAME = "mw-static-v(\d+)";', text)
    if version:
        text = text.replace(version.group(0), 'var CACHE_NAME = "mw-static-v%d";' % (int(version.group(1)) + 1))
    write_text(path, text)
    return True


def main():
    rows, titles, calculators = canonical_rows()
    manifest = build_manifest(rows, titles, calculators)
    write_text(ROWS_MANIFEST, json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    pages = write_pages(rows, titles, calculators)
    wired, scanned = wire_pages()
    worker = update_service_worker()
    print("rows:", len(rows))
    print("section pages:", pages, "+ main dashboard")
    print("tracking wired:", wired, "of", scanned, "pages")
    print("service worker updated:", worker)


if __name__ == "__main__":
    main()
