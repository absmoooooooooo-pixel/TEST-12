# Material Weight Calculation — All Languages Ads

Central advertisement system for **every** engineering calculator page, in
**every** language. One configuration, one renderer, no per-page ad code.

## Two fields to fill in

Open `ads.config.js` and look at section 4 (`ads`):

```js
"house-banner": {
    imageUrl: "",      // <- hosted image URL
    redirectUrl: "",   // <- destination when the image is clicked
    size: "leaderboard",
    displayMode: "contain",
    altText: "Advertisement"
}
```

- **imageUrl** — leave empty to show the clean placeholder box. Fill it and the
  image appears on every page that uses this advertisement.
- **redirectUrl** — leave empty and the image is *not* clickable. Fill it and
  the whole image becomes a link that opens in a new tab with
  `rel="noopener noreferrer sponsored"`.
- Only `http(s)://` and same-site relative links are accepted; anything else
  (`javascript:`, `data:`, …) is rejected and the image stays static.

## Where it appears

```
1. Calculator inputs
2. Calculate button
3. Reset button
4. Advertisement banner   <- this system
5. Calculation results    <- always below the banner
```

The banner is mounted once on page load and is never removed or moved by
Calculate / Reset. It is present before and after a calculation.

## Choosing pages

Section 5 (`placements`) connects an advertisement to pages:

```js
{ ad: "plate-leaderboard", calculators: ["plate"], languages: ["en", "pt", "de"] }
```

| Goal | Placement |
| --- | --- |
| All calculators, all languages | `calculators: "*", languages: "*"` |
| Selected languages only | `languages: ["pt", "es"]` |
| One calculator only | `calculators: ["plate"]` |
| One calculator + one language | `calculators: ["plate"], languages: ["de"]` |
| Different ads per language | several placements, one per language |

An exact calculator + language always wins over a wildcard; the last matching
placement wins a tie.

The same advertisement id can be assigned to as many placements as you like,
so one creative can serve English, Portuguese and German plate pages at once.

## Image formats

Named formats live in `defaults.sizes` (leaderboard 728×90, largeBanner
970×250, rectangle 336×280, mediumRectangle 300×250, mobileBanner 320×100,
verticalBanner 300×600, wideSkyscraper 160×600). Any other size works too:

```js
size: { width: 1200, height: 300 }
```

`displayMode` is `"contain"` (default — the whole creative is always visible,
never cropped or stretched) or `"cover"` (fills the configured box, edges may
be cropped).

## Calculator slugs

`plate`, `pipe`, `round-bar`, `square-bar`, `hexagon-bar`,
`hexagonal-bar-with-round-hole`, `round-bar-with-hexagonal-hole`,
`triangular-bar`, `trapezoidal-bar`, `trapezium-bar`, `c-channel`, `i-channel`,
`l-channel`, `t-channel`, `box-channel`, `e-section`, `shell`, `dish-ends`,
`flange-plate`, `circular-plate`, `solid-cone`, `truncated-cone`,
`sphere-ball`, `nut-bolt`

## Language codes

`en` (`/frontend/…`), `es`, `de`, `fr`, `pt`, `zh`, `ja`, `hi`, `mr`, `ar`.

## Files

| File | Purpose |
| --- | --- |
| `ads.config.js` | Advertisements + placements — **the only file to edit** |
| `ads.js` | Shared renderer used by every calculator page |
| `ads.css` | Banner styling, built on the existing site theme tokens |
| `README.md` | This reference |
