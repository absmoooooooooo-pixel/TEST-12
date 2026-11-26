# Multilingual typography audit — November 2026

Typography-only pass over the Metal Weight Calculator site. No layout, colour,
component, formula, dimension, arrow, routing or English-master change.

## What was actually wrong

Measured in headless Chrome against the running site, before any edit:

| Symptom in the screenshots | Measured cause |
| --- | --- |
| Small Devanagari text looks joined / marks touch | `line-height` 1.15–1.25 inherited from English values on `button.calculate-btn`, `.reset-btn`, `.tool-name`, `.filter-pill`, `.hero-eyebrow`, headings and the material-grade blocks |
| Dropdown options look like a different typeface | `select`, `option`, `input`, `textarea`, `button` did not inherit a font at all and fell back to Arial next to a Segoe UI / Noto Devanagari label |
| Diagram labels hard to read | SVG `<text>` inherited no script font either, and the English sizes (13–15px) are the Arial floor |
| Matras "merged"/clipped in headings | `.brand h1` at `line-height: 1.20` with 21px Devanagari |
| Rotated vertical labels unreadable | `transform="rotate(-90 …)"` from the English master (see decision below) |

## Corrections

`frontend/i18n/localized-support.css` (the site's existing per-script layer):

* section 9 — form controls inherit the page script stack and get a 1.6 line box,
  so a `<option>` is shaped exactly like the label above it;
* headings (`h1`–`h4`, `.info-title`, `.grades-heading h2`) at 1.5;
* script-safe leading for the single-line UI labels that were tuned to Arial
  (`.calculate-btn`, `.reset-btn`, `.example-result-label`, `.related-calc-name`,
  `.combo-value`, `.app-title`, `.grade-name`, `.history-clear`, the header pill
  labels), `.header .brand h1` at 1.45;
* home-page small text (`.filter-pill`, `.hero-eyebrow`) at 12px / 1.45 and
  `.tool-name` at 12px / 1.4 — those were 10.5–11.5px with 1.15–1.24 leading;
* section 10 — diagram text gets the script family, normal tracking, and 16.5px
  above 640px instead of the 13–15px English floor; the 18/19px mobile values are
  unchanged. No anchor, coordinate or arrow is touched.

`frontend/i18n/i18n.js`:

* `syncScriptTypography()` loads `localized-support.css` when the runtime
  translates an English master page in place, and removes it on the way back to
  English. Before this, in-place translation lost the whole script layer: the
  `lang` attribute changed but the stylesheet was never there.
* `adaptVerticalLabels()` stands **CJK** dimension labels upright (square glyphs
  read correctly upright) only where the whole label still fits inside the
  drawing; it re-runs on load, after fonts resolve and on resize.

## The vertical-label decision

Standing Devanagari dimension labels upright was implemented and then rejected:
`writing-mode: vertical-rl; text-orientation: upright` lays the akshara out
character by character, so `जाड` rendered as `ज` / `ा` / `ड` and `रुं` overlapped
its arrow. That breaks shaping, which no typography fix may do. Devanagari and
Arabic therefore keep the -90° rotation of the English master — the
engineering-drawing convention — with the script font and a larger size. A long
label such as `बाहेरील उंची` would not fit upright at all.

## Cache

`localized-support.css?v=7 → v=8` on all 234 static pages, the injected href
pinned to `?v=8`, i18n runtime `61 → 62` (`tools/build_i18n.py`,
`tools/bump_i18n_version.py`), `service-worker.js` `CACHE_NAME` `v132 → v133`
(its documented release step, and its asset handler is cache-first).

## Verification

Headless Chrome (`--headless=new`, CDP), 1280×900 and 390×844, `document.fonts`
ready and `lang` settled before every measurement: 15 page/viewport pairs —
`mr`, `hi`, `ar`, `ja`, `zh`, `de`, `fr`, `es`, `pt`, `en` calculators, the `mr`
and `ar` home pages, and an English master page switched to Marathi in place.

* flags per page: mr/hi/ar/ja plate 10 (was 29–46), mr home 2 (was 73),
  ar home 0 (was 35), en master 1 (unchanged, before and after);
* `hScroll: false` on every page and viewport — no horizontal overflow introduced;
* body font / leading: Segoe UI 1.65 (mr/hi/ja/zh), Noto Naskh Arabic 1.7 (ar),
  Arial 1.5 (en/de/fr/es/pt — untouched);
* no SVG label flagged `outside` in any language after the change;
* the 10 remaining flags on the mr/hi pages are a 1×1 screen-reader label, an
  11px digit badge, and value-only `strong` rows containing digits and units.

Before/after pairs: `before/` and `after/` alongside this file.

## Still open

* Rotated Devanagari/Arabic dimension labels keep the -90° orientation. Making
  them horizontal needs per-drawing coordinate work in 10 language folders.
* `.filter-pill span` count badges stay at 8.5px (digits only).
* Untranslated content, outside typography: `All dimensions are in millimeters.`
  and the Material Grades block still render in English inside
  `/mr/calculators/plate/`, and `/mr/calculators/solid-cone/` shows `H`, `D`,
  `FRONT VIEW` until the translator runs.
