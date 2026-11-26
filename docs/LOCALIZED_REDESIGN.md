# Localized pages: rebuild and parity with the English master

Every non-English page is generated from the approved English master page of the
same calculator. The English site is never edited by this pipeline, and the
localized pages carry **no design of their own**: they load the same stylesheets,
the same markup structure and the same scripts as English, and differ only in the
language of their text. Switching language therefore changes the words, not the
website.

## Languages and pages

| Folder | Language | Build behaviour |
| --- | --- | --- |
| `hi/` | Hindi | Rebuilt from the English master; native strings; Devanagari font stack |
| `mr/` | Marathi | Rebuilt from the English master; native strings; Devanagari font stack |
| `de/` | German | Rebuilt from the English master; native strings |
| `es/` | Spanish | Rebuilt from the English master; native strings |
| `fr/` | French | Rebuilt from the English master; native strings |
| `ja/` | Japanese | Rebuilt from the English master; native strings; Japanese font stack |
| `ar/` | Arabic | Rebuilt from the English master; native strings; `dir="rtl"`; Arabic font stack |
| `pt/` | Portuguese | Authored native wording preserved; shared-script IDs and home canonical repaired |
| `zh/` | Chinese | Existing reference wording preserved and corrected where copy was wrong |

Each language contains the home page, the about page and all 24 calculator pages:
26 pages × 9 languages = 234 localized pages.

## Source of truth

| Layer | Location | Changed by this pipeline? |
| --- | --- | --- |
| Markup structure, SVG drawings, IDs, CSS classes, section order | `index.html`, `frontend/**/index.html` | English is read only; localized pages are generated from it |
| Styling | `frontend/calculators/calculator-base.css`, `frontend/shared/*.css`, `frontend/i18n/language-switcher.css`, `Material Weight Calculator on Language Ads/row-ads.css` | Not forked — localized pages link exactly the same files |
| Native page text | Reviewed localized page and `frontend/i18n/<code>/<code>.json` | Reused verbatim; exact page strings take priority over generic dictionary strings |
| Calculator interaction | `frontend/calculators/<slug>/<slug>.js` | Reused directly |
| Formula engine | `backend/calculations/` → `frontend/assets/js/calc-engine.js` | One engine for every language |
| Number systems | `frontend/i18n/number-format.js`, `frontend/shared/input-localization.js`, `frontend/shared/numeric-keypad.js` | Existing locale parsing/formatting reused |
| Language support | `frontend/i18n/localized-support.css` | The only stylesheet a localized page adds |

The single extra stylesheet contains no colours, widths, spacing, card styles or
breakpoints. It only provides script-capable font stacks, a slightly larger
line-height for Devanagari and Arabic, `overflow-wrap` so long translated words
cannot overflow a card, and RTL corrections for Arabic. Everything visible is
otherwise inherited from the English master.

## Rebuild

```bash
python tools/build_localized_redesign.py
python tools/verify_localized_redesign.py --calc
python tools/audit_untranslated.py
python tools/check_all_site_links.py
```

To restyle without rebuilding content (adds only the support stylesheet link):

```bash
python tools/build_localized_redesign.py --no-rebuild
```

To rebuild selected languages:

```bash
python tools/build_localized_redesign.py --lang hi --lang mr
```

The build is idempotent: its marker, stylesheet link and `data-mw-redesign`
attribute are removed before being re-applied. It fingerprints the English master
before and after the run and aborts if any English page or shared script changed.

The Portuguese build keeps its native wording, but it does repair two
pre-existing technical issues: localized element IDs are mapped back to the
English IDs expected by the shared calculators, and the home page canonical URL
points to `/pt/`. Only `id`, `for`, `aria-*` and `#hash` references are renamed;
visible Portuguese text is unchanged.

## What changed in this rebuild

Localized pages used to run a second presentation layer of their own: a 1080px
column instead of 850px, a different green, gradient backgrounds, restyled cards,
and a calculator workspace whose result panel had been moved into a sticky
sidebar. That is why a translated page looked like a different website.

That layer is gone. `frontend/i18n/localized-design.css` was deleted, the
sidebar/split-workspace pass was removed from the builder, and every localized
page was regenerated from its English master page. The only remaining
language-specific file is `frontend/i18n/localized-support.css`.

The localized presentation marker is now `MW-LOCALIZED-PARITY` at version 5.

Each page's own localized `og:site_name` is written to `og:image:alt` and to the
Organization / WebSite schema names, so social previews and structured data carry
the localized brand rather than the English one.

## Verification

`tools/verify_localized_redesign.py` checks all 234 pages against the English
master page of the same calculator:

- the parity marker, the single support-stylesheet link and `lang` / `dir`;
- **identical section and card skeleton**, in the same order;
- **identical stylesheet set** (only `localized-support.css` may be added) and
  identical script set (only `dict-<code>.js` / `i18n-static.js` /
  `dashboard-static.js` may replace their runtime equivalents);
- no `.mw-calc-shell` / `.mw-calc-side` split layout and no `localized-design.css`;
- correct canonical URL and the full hreflang set;
- a link to the shared local calculation engine and every form/result ID from
  the English page;
- no visible English sentence fragments;
- no parity marker on any English page.

With `--calc` it also runs the shared engine with two sample calculations and
compares the numbers with the approved values.

`tools/audit_untranslated.py` is an independent visible-text audit; it reports
zero English-sentence candidates for every localized language. It cannot see
mistranslations or malformed hidden dictionary keys, which is why native review
of representative pages still matters.

## Advertisements

The row advertisement is data, not design: every language loads the same
`row-ads.js` / `row-ads.css`, and the card renders when that language's Row file
(`Material Weight Calculator on Language Ads/<code>/<row>.js`) has an
`imageUrl` and `destinationUrl`. English currently has the live advertiser;
other languages show the identical card as soon as their Row file is filled in,
and show nothing at all while it is empty.
