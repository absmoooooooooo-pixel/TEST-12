/* ==========================================================================
   MATERIAL WEIGHT CALCULATOR — ROW ADVERTISEMENT SYSTEM (SHARED CONFIG)
   --------------------------------------------------------------------------
   This file describes the system itself: the supported languages, the six
   Rows, and which calculators belong to each Row. It is NOT where you paste
   advertisement URLs.

   WHERE TO PASTE YOUR ADVERTISEMENT
     Material Weight Calculator on Language Ads/
         en/  a-row.js  b-row.js  c-row.js  d-row.js  e-row.js  f-row.js
         es/  a-row.js  b-row.js  ...      (same six files per language)
         de/  fr/  pt/  zh/  ja/  hi/  mr/  ar/

     Open the Row file for the language you want, e.g. en/a-row.js, and fill:
         imageUrl:        "https://..."   <- advertisement image
         destinationUrl:  "https://..."   <- page opened by clicking it
         enabled:         true            <- advertisement status

     Optional card content (leave out or empty when not supplied):
         description     Advertisement Description shown under the title
         businessName, title, businessInfo, contactNumber, websiteUrl,
         ctaText, altText, width, height, displayMode, openInNewTab

     The whole card is one link to destinationUrl: the image, the description
     and the CLICK HERE button all open it in a new tab.

     The same advertisement then appears on all four calculators of that Row,
     in that language only. Nothing else has to be edited, and no calculator
     page holds its own advertisement code.

   HOW IT IS LOADED
     Every calculator page includes three tags only:
         row-ads.css, row-ads.config.js, row-ads.js
     The renderer detects the page language and calculator from the address,
     loads ONLY that language's Row file for that calculator, and shows the
     advertisement between the Reset button and the result card.

   DISPLAY RULE
     The advertisement is shown only when BOTH imageUrl and destinationUrl
     are valid and enabled is true. Otherwise nothing is inserted at all — no
     empty frame and no reserved blank space.
   ========================================================================== */

window.MW_ROW_ADS_CONFIG = {

    /* Marks the page as served by this system. */
    active: true,

    /* ======================================================================
       1. SUPPORTED LANGUAGES
       ----------------------------------------------------------------------
       Detected from the page address:
         /frontend/calculators/...  -> en  (English pages)
         /es/calculators/...        -> es
         /de/calculators/...        -> de
         /fr/calculators/...        -> fr
         /pt/calculators/...        -> pt
         /zh/calculators/...        -> zh
         /ja/calculators/...        -> ja
         /hi/calculators/...        -> hi
         /mr/calculators/...        -> mr
         /ar/calculators/...        -> ar
       Each language folder holds its own independent six Row files.
    ====================================================================== */
    languages: ["en", "es", "de", "fr", "pt", "zh", "ja", "hi", "mr", "ar"],
    defaultLanguage: "en",

    /* Folder name that holds the language folders (this folder). */
    folder: "Material Weight Calculator on Language Ads",

    /* ======================================================================
       2. THE SIX ROWS (fixed classification — do not move a calculator)
       ----------------------------------------------------------------------
       A-Row, B-Row, C-Row, D-Row, E-Row, F-Row: four calculators each,
       24 calculators in total. The order inside a Row is the order used in
       the Row file headers.
    ====================================================================== */
    rows: ["a-row", "b-row", "c-row", "d-row", "e-row", "f-row"],

    rowTitles: {
        "a-row": "A-Row",
        "b-row": "B-Row",
        "c-row": "C-Row",
        "d-row": "D-Row",
        "e-row": "E-Row",
        "f-row": "F-Row"
    },

    /* Row -> the four calculator slugs (folder names under /calculators/). */
    calculators: {
        "a-row": ["plate", "c-channel", "round-bar", "square-bar"],
        "b-row": ["circular-plate", "e-section", "round-bar-with-hexagonal-hole", "triangular-bar"],
        "c-row": ["flange-plate", "t-channel", "trapezium-bar", "hexagonal-bar-with-round-hole"],
        "d-row": ["sphere-ball", "pipe", "trapezoidal-bar", "solid-cone"],
        "e-row": ["l-channel", "shell", "box-channel", "truncated-cone"],
        "f-row": ["i-channel", "dish-ends", "hexagon-bar", "nut-bolt"]
    },

    /* ======================================================================
       3. DEFAULTS (used when a Row file leaves the option out)
    ====================================================================== */
    defaults: {
        /* Natural creative size, used to reserve the right space so the page
           does not jump while the image loads. Any size is accepted; the
           image is always responsive and never distorted. */
        width: 728,
        height: 90,

        /* "contain" = whole image visible (default), "cover" = fill and crop. */
        displayMode: "contain",

        /* Open the destination in a new tab. Links always carry
           rel="noopener noreferrer sponsored". */
        openInNewTab: true
    },

    /* Text used for the visible identification label and for screen readers
       when a Row file has no altText. */
    labels: {
        en: "Advertisement",
        es: "Publicidad",
        de: "Werbung",
        fr: "Publicité",
        pt: "Publicidade",
        zh: "广告",
        ja: "広告",
        hi: "विज्ञापन",
        mr: "जाहिरात",
        ar: "إعلان"
    },

    /* Default call-to-action text. A Row file can override it with ctaText.
       The button is the visible action; clicking anywhere on the card does the
       same thing. */
    ctaLabels: {
        en: "Click Here →",
        es: "Haz clic aquí →",
        de: "Hier klicken →",
        fr: "Cliquez ici →",
        pt: "Clique aqui →",
        zh: "点击这里 →",
        ja: "ここをクリック →",
        hi: "यहाँ क्लिक करें →",
        mr: "इथे क्लिक करा →",
        ar: "اضغط هنا →"
    },

    /* Small labels used only when the advertiser supplies that information. */
    ui: {
        en: { contact: "Contact", website: "Website" },
        es: { contact: "Contacto", website: "Sitio web" },
        de: { contact: "Kontakt", website: "Webseite" },
        fr: { contact: "Contact", website: "Site web" },
        pt: { contact: "Contato", website: "Site" },
        zh: { contact: "联系方式", website: "网站" },
        ja: { contact: "お問い合わせ", website: "ウェブサイト" },
        hi: { contact: "संपर्क", website: "वेबसाइट" },
        mr: { contact: "संपर्क", website: "संकेतस्थळ" },
        ar: { contact: "اتصل بنا", website: "الموقع" }
    }
};

/* Read by the shared renderer and lets any older ad script stand down. */
window.MW_ROW_ADS_ACTIVE = true;
