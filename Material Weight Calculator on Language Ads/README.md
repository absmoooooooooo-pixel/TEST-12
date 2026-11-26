# Material Weight Calculator on Language Ads

Row-based advertisement system for every calculator page, in every language.
**One file per Row per language.** Paste two URLs and the advertisement appears
on the four calculators of that Row, in that language only.

```
Material Weight Calculator on Language Ads/
├── row-ads.config.js          shared system config (Rows + calculator map)
├── row-ads.js                 shared renderer (used by every page)
├── row-ads.css                banner styling (matches the site theme)
├── en/  a-row.js b-row.js c-row.js d-row.js e-row.js f-row.js
├── es/  a-row.js … f-row.js
├── de/  fr/  pt/  zh/  ja/  hi/  mr/  ar/        (same six files)
└── README.md
```

## 1. Where to paste the two URLs

Open the Row file for the language you want, for example
`en/a-row.js`, and fill the three fields:

```js
window.MW_ROW_ADS.en["a-row"] = {
    enabled: true,                                   // true = show, false = hide

    imageUrl: "https://example.com/ad-image.jpg",    // 1. advertisement image
    destinationUrl: "https://example.com/plate",     // 2. where a click goes

    altText: "Advertisement",
    width: 728,
    height: 90,
    displayMode: "contain",
    openInNewTab: true,

    /* Optional card content — fill only what the advertiser supplies. */
    businessName: "",
    title: "",
    description: "",
    businessInfo: "",
    contactNumber: "",
    websiteUrl: "",
    ctaText: ""
};
```

That is the only edit. Every calculator in that Row shows the advertisement at
once, and changing the file updates all four pages together. Missing optional
fields are simply not rendered — no empty labels or placeholder text.

## 2. Row classification (fixed — 24 calculators)

| Row | Calculators | Row file |
| --- | --- | --- |
| A-Row | Plate, C Channel, Solid Round Bar, Square Bar | `a-row.js` |
| B-Row | Circular Plate, E-Section, Round Bar with Hexagonal Hole, Triangular Bar | `b-row.js` |
| C-Row | Flange Plate, T Channel, Trapezium Bar, Hexagonal Bar with Round Hole | `c-row.js` |
| D-Row | Sphere / Ball, Pipe, Trapezoidal Bar, Solid Cone | `d-row.js` |
| E-Row | L Channel, Shell, Box Channel, Truncated Cone (Conical Reducer) | `e-row.js` |
| F-Row | I Channel, Dish Ends, Hexagon Bar, Nut & Bolt | `f-row.js` |

Calculator folder slugs in the same order:

- **A** — `plate`, `c-channel`, `round-bar`, `square-bar`
- **B** — `circular-plate`, `e-section`, `round-bar-with-hexagonal-hole`, `triangular-bar`
- **C** — `flange-plate`, `t-channel`, `trapezium-bar`, `hexagonal-bar-with-round-hole`
- **D** — `sphere-ball`, `pipe`, `trapezoidal-bar`, `solid-cone`
- **E** — `l-channel`, `shell`, `box-channel`, `truncated-cone`
- **F** — `i-channel`, `dish-ends`, `hexagon-bar`, `nut-bolt`

## 3. Languages

| Language | Folder | Route |
| --- | --- | --- |
| English | `en/` | `/frontend/calculators/<slug>/` |
| Spanish | `es/` | `/es/calculators/<slug>/` |
| German | `de/` | `/de/calculators/<slug>/` |
| French | `fr/` | `/fr/calculators/<slug>/` |
| Portuguese | `pt/` | `/pt/calculators/<slug>/` |
| Chinese | `zh/` | `/zh/calculators/<slug>/` |
| Japanese | `ja/` | `/ja/calculators/<slug>/` |
| Hindi | `hi/` | `/hi/calculators/<slug>/` |
| Marathi | `mr/` | `/mr/calculators/<slug>/` |
| Arabic | `ar/` | `/ar/calculators/<slug>/` |

Each language has its own six files. Nothing is shared between languages, so
English settings can never appear on a Spanish page.

## 4. Display rules

- Shown **only** when `imageUrl` **and** `destinationUrl` are both valid and
  `enabled` is `true`.
- If either URL is empty, invalid, or `enabled: false`, **nothing is inserted**:
  no empty box, no reserved blank space, no layout change.
- **The whole card is one link** to `destinationUrl` (open in a new tab): the
  green ribbon, the image, the title, the description and the CLICK HERE
  button all open it. It is a single overlay link, so nothing is nested and
  there is only one click target. Links are validated (only `http(s)://` and
  same-site paths such as `/offers/x` are accepted; `javascript:`, `data:` and
  similar are rejected) and carry `rel="noopener noreferrer sponsored"`.
- A broken image removes the card instead of leaving a gap.
- Position on every page: inputs → **Calculate** → **Reset** →
  **advertisement** → results. It stays in place through Calculate and Reset,
  and never covers or blocks the calculator.
- The card uses the same `.card` shell and content width as Material Grades /
  Material Selection, with a green ADVERTISEMENT ribbon across the top.
- The layout follows the creative's own proportions:

  | Creative | Layout |
  | --- | --- |
  | banner (3:1 and wider) | image across the full card width, text below |
  | landscape (~16:9) | image left (~46%), text right |
  | square (~1:1) | image left (~42%), text right |
  | portrait (tall) | narrow image left (~34%), text right |

  The image frame copies the image ratio, so the creative fills it edge to
  edge instead of floating in an empty box; `object-fit: contain` means it is
  never stretched or cropped. The format is re-checked against the real image
  size when it loads, so `width`/`height` are only a starting hint.
- Phones: ribbon, image, title, description, optional contact/website, then a
  full-width CLICK HERE button. Nothing scrolls sideways.

## 5. Options inside a Row file

| Option | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | `false` switches this Row's advertisement off everywhere |
| `imageUrl` | `""` | creative address; empty = nothing shown |
| `destinationUrl` | `""` | click destination; empty = nothing shown |
| `altText` | language label | screen-reader text |
| `width` / `height` | `728` / `90` | the creative's natural ratio; a hint that picks the first layout, corrected from the real image when it loads |
| `displayMode` | `"contain"` | `"contain"` shows the whole image at its own ratio; `"cover"` fills the media box and crops |
| `openInNewTab` | `true` | `false` opens the destination in the same tab |
| `businessName` | `""` | small name above the title, or the heading when no title is given |
| `title` | `""` | advertisement / offer heading |
| `description` | `""` | **Advertisement Description** — multi-line promotional text under the title; hidden when empty |
| `businessInfo` | `""` | optional extra business line |
| `contactNumber` | `""` | displayed as a safe `tel:` link |
| `websiteUrl` | `""` | displayed as a validated website link (not used as the click destination) |
| `ctaText` | localized "Click Here →" | label of the call-to-action button |

Every click anywhere on the card opens `destinationUrl`, so click tracking and
analytics remain unchanged. Any image size works (728×90, 970×250, 336×280,
300×250, 320×100, 300×600 or anything else): it is scaled to fill its frame,
keeps its own aspect ratio and is never distorted.

## 6. How pages use it

Every calculator page includes three tags — nothing else:

```html
<link rel="stylesheet" href="../../../Material Weight Calculator on Language Ads/row-ads.css?v=7">
<script src="../../../Material Weight Calculator on Language Ads/row-ads.config.js?v=7" defer></script>
<script src="../../../Material Weight Calculator on Language Ads/row-ads.js?v=7" defer></script>
```

When the stylesheet or renderer changes, raise that `?v=` number on the pages
and in `service-worker.js` so cached copies are replaced.

`row-ads.js` reads the language and calculator from the page address, looks up
the Row in `row-ads.config.js`, loads **only** that language's Row file
(`en/a-row.js`) and mounts the banner above the result card. No calculator
page contains advertisement code, links or image URLs.

## 7. Adding a language later

1. Create the folder, e.g. `it/`.
2. Copy the six files from `en/` and change `window.MW_ROW_ADS.en` to
   `window.MW_ROW_ADS.it` in each.
3. Add `"it"` to `languages` and a label to `labels` in `row-ads.config.js`.
4. Add the three tags above to the new language's calculator pages.
