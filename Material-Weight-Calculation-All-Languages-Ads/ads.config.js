/* ==========================================================================
   MATERIAL WEIGHT CALCULATION — CENTRAL ADVERTISEMENT CONFIGURATION
   --------------------------------------------------------------------------
   This is the ONLY file you need to edit to publish an advertisement on any
   calculator page, in any language.

   HOW IT WORKS
   1. Describe an advertisement once in the "ads" section (image + redirect).
   2. Assign it in the "placements" section to any combination of
      calculators and languages.
   3. That is all. Every calculator page loads this file and the shared
      renderer (ads.js) puts the banner in the band between the Calculate /
      Reset buttons and the calculation result card.

   Nothing else in the site has to be touched, and no page has its own copy
   of the advertisement code.

   WHERE THE BANNER APPEARS ON A PAGE
     1. Calculator input section
     2. Calculate button
     3. Reset button
     4. >>> Advertisement banner (this system) <<<
     5. Calculation result / output section
   The banner is always present, before and after a calculation, and the
   result card always stays below it.

   FILE OVERVIEW (this folder)
     ads.config.js  <- advertisements + which pages show them  (edit this)
     ads.js         <- shared renderer, used by every page     (do not edit)
     ads.css        <- banner styling, matches the site theme  (do not edit)
     README.md      <- quick reference for the two fields below
   ========================================================================== */

window.MW_ADS_CONFIG = {

    /* ======================================================================
       1. SUPPORTED LANGUAGES  (reference list, nothing to edit here)
       ----------------------------------------------------------------------
       The language is detected from the page address:
         /frontend/calculators/...  -> "en"
         /es/calculators/...        -> "es"
         /de/calculators/...        -> "de"
         /fr/calculators/...        -> "fr"
         /pt/calculators/...        -> "pt"
         /zh/calculators/...        -> "zh"
         /ja/calculators/...        -> "ja"
         /hi/calculators/...        -> "hi"
         /mr/calculators/...        -> "mr"
         /ar/calculators/...        -> "ar"

       In "placements" below, a language list accepts any of these codes,
       "*" (or "all") for every language, or a comma separated string such
       as "en, pt, de".
    ====================================================================== */
    languages: ["en", "es", "de", "fr", "pt", "zh", "ja", "hi", "mr", "ar"],

    /* ======================================================================
       2. SUPPORTED CALCULATORS  (reference list, nothing to edit here)
       ----------------------------------------------------------------------
       The calculator is detected from the page address:
         .../calculators/plate/index.html -> "plate"
         .../calculators/pipe/index.html  -> "pipe"

       Use one of these slugs, or "*" (or "all") for every calculator:
         box-channel, c-channel, circular-plate, dish-ends, e-section,
         flange-plate, hexagon-bar, hexagonal-bar-with-round-hole, i-channel,
         l-channel, nut-bolt, pipe, plate, round-bar,
         round-bar-with-hexagonal-hole, shell, solid-cone, sphere-ball,
         square-bar, t-channel, trapezium-bar, trapezoidal-bar,
         triangular-bar, truncated-cone
    ====================================================================== */
    calculators: [
        "plate", "pipe", "round-bar", "square-bar", "hexagon-bar",
        "hexagonal-bar-with-round-hole", "round-bar-with-hexagonal-hole",
        "flat-bar", "triangular-bar", "trapezoidal-bar", "trapezium-bar",
        "c-channel", "u-channel", "i-channel", "l-channel", "t-channel",
        "box-channel", "e-section", "shell", "dish-ends", "flange-plate",
        "circular-plate", "solid-cone", "truncated-cone", "sphere-ball",
        "nut-bolt"
    ],

    /* ======================================================================
       3. DEFAULTS (apply to every advertisement unless it says otherwise)
    ====================================================================== */
    defaults: {
        /* "contain"  = whole image always visible, never cropped (default)
           "cover"    = image fills the configured box, edges may be cropped */
        displayMode: "contain",

        /* Open the redirect destination in a new tab. Links always get
           rel="noopener noreferrer sponsored" for safety. */
        openInNewTab: true,

        /* Standard banner formats. Referenced by name in an advertisement's
           "size" field, or ignore them and pass a custom {width,height}. */
        sizes: {
            leaderboard:      { width: 728, height: 90 },   // 728 x 90
            largeBanner:      { width: 970, height: 250 },  // 970 x 250
            rectangle:        { width: 336, height: 280 },  // 336 x 280
            mediumRectangle:  { width: 300, height: 250 },  // 300 x 250
            mobileBanner:     { width: 320, height: 100 },  // 320 x 100
            verticalBanner:   { width: 300, height: 600 },  // 300 x 600
            wideSkyscraper:   { width: 160, height: 600 },  // 160 x 600
            billboard:        { width: 970, height: 250 },  // 970 x 250
            custom:           { width: 728, height: 90 }    // replace the numbers
        }
    },

    /* ======================================================================
       4. ADVERTISEMENTS  ("the creative")
       ----------------------------------------------------------------------
       IMAGE_URL    - full address of the hosted image. Leave "" to show the
                      empty placeholder box (the page still reserves the space
                      and looks correct).
       REDIRECT_URL - where a click goes. Leave "" to make the image
                      non-clickable (no link is created at all).
       IMAGE_SIZE   - a name from defaults.sizes above, or { width, height }.
       DISPLAY_MODE - "contain" or "cover" (optional, overrides the default).
       ALT_TEXT     - accessibility text for the image.
       ENABLED      - false switches this advertisement off everywhere.

       One entry can be used by any number of pages, in any number of
       languages: assign the same id in several placements below.
    ====================================================================== */
    ads: {

        /* Shipped default: empty, so every calculator page shows a clean
           placeholder banner until you publish a real one. */
        "house-banner": {
            imageUrl: "",
            redirectUrl: "",
            size: "leaderboard",
            displayMode: "contain",
            altText: "Advertisement",
            enabled: true
        }

        /* ------------------------------------------------------------------
           EXAMPLES (copy, uncomment the placement in section 5, fill in the
           two URLs, and the banner appears without touching any page).

           // 728 x 90 leaderboard for the Plate calculator in English,
           // Portuguese and German.
           "plate-leaderboard": {
               imageUrl: "https://your-image-host.example/plate-en-pt-de-728x90.png",
               redirectUrl: "https://client.example/plate-offer",
               size: "leaderboard",
               displayMode: "contain",
               altText: "Special offer for plate buyers"
           },

           // 336 x 280 rectangle only on Portuguese pages of every calculator.
           "pt-rectangle": {
               imageUrl: "https://your-image-host.example/pt-336x280.jpg",
               redirectUrl: "https://client.example/pt",
               size: "rectangle",
               displayMode: "contain",
               altText: "Oferta"
           },

           // 300 x 600 vertical creative, cropped to fill (cover) in the box.
           "vertical-cover": {
               imageUrl: "https://your-image-host.example/300x600.jpg",
               redirectUrl: "https://client.example/vertical",
               size: "verticalBanner",
               displayMode: "cover",
               altText: "Advertisement"
           },

           // Custom size (no fixed format) - proportions are kept as supplied.
           "custom-size": {
               imageUrl: "https://your-image-host.example/1200x300.jpg",
               redirectUrl: "",
               size: { width: 1200, height: 300 },
               altText: "Advertisement"
           }
           ------------------------------------------------------------------ */
    },

    /* ======================================================================
       5. PLACEMENTS  ("where it appears")
       ----------------------------------------------------------------------
       Each placement connects ONE advertisement to a set of pages:

           { ad: "<id from section 4>", calculators: [...], languages: [...] }

       calculators / languages accept:
         ["plate"]                    one calculator / language
         ["plate", "pipe"]            several
         "*"  or ["*"] or ["all"]     every calculator / every language
         "en, pt, de"                 comma separated string also works
         { width, height }            a custom size in the ad itself

       Resolution order when several placements match one page:
         - an exact calculator + exact language wins over a wildcard,
         - the last matching placement wins a tie,
         - the more specific placement is used.

       Ready-made scenarios:
         - One advertisement for all languages ....... house-banner (below)
         - Selected languages only ................... languages: ["pt","es"]
         - One calculator only ...................... calculators: ["plate"]
         - One calculator + one language ............ both lists filled
         - Different ads per language ............... several placements
    ====================================================================== */
    placements: [

        /* Every calculator page, every language.
           Replace the image and redirect inside "house-banner" above, or
           point this placement at another id from section 4. */
        {
            ad: "house-banner",
            calculators: "*",
            languages: "*"
        }

        /* ------------------------------------------------------------------
           EXAMPLES - uncomment the lines you need.

           // Same creative on the Plate calculator in English, Portuguese,
           // and German only.
           // { ad: "plate-leaderboard", calculators: ["plate"], languages: ["en", "pt", "de"] },

           // Portuguese rectangle on every calculator (Portuguese pages only).
           // { ad: "pt-rectangle", calculators: "*", languages: ["pt"] },

           // German pipe calculator keeps its own creative.
           // { ad: "pipe-de", calculators: ["pipe"], languages: ["de"] },

           // A vertical creative on two calculators, all languages.
           // { ad: "vertical-cover", calculators: ["plate", "pipe"], languages: "*" }

           // A placement can also carry the creative inline, without an entry
           // in section 4:
           // {
           //     ad: {
           //         imageUrl: "https://your-image-host.example/inline-728x90.png",
           //         redirectUrl: "https://client.example/inline",
           //         size: "leaderboard"
           //     },
           //     calculators: ["round-bar"],
           //     languages: ["en"]
           // }
           ------------------------------------------------------------------ */
    ]
};
