/* ==========================================================================
   ROW ADVERTISEMENT — ARABIC — C-ROW
   --------------------------------------------------------------------------
   This ONE file controls the advertisement on the four C-ROW calculators
   in Arabic:

     1. Flange Plate Weight Calculator           /ar/calculators/flange-plate/
     2. T Channel                                /ar/calculators/t-channel/
     3. Trapezium Bar                            /ar/calculators/trapezium-bar/
     4. Hexagonal Bar with Round Hole            /ar/calculators/hexagonal-bar-with-round-hole/

   WHAT TO EDIT (three fields)
     imageUrl         paste the advertisement image address
     destinationUrl   paste the page a click should open
     enabled          true = show it, false = hide it

   The advertisement appears on ALL FOUR pages above at the same time, in
   Arabic only. It is shown only when BOTH URLs are valid; leave either
   one empty and nothing is displayed at all — no empty box, no blank space.

   OPTIONAL
     altText         text for screen readers (default: إعلان)
     width/height    the creative's natural size (default 728 x 90)
     displayMode     "contain" (whole image) or "cover" (fill and crop)
     openInNewTab    true (default) or false
   ========================================================================== */

window.MW_ROW_ADS = window.MW_ROW_ADS || {};
window.MW_ROW_ADS.ar = window.MW_ROW_ADS.ar || {};

window.MW_ROW_ADS.ar["c-row"] = {
    enabled: true,

    /* 1. ADVERTISEMENT IMAGE URL --------------------------------------- */
    imageUrl: "",

    /* 2. ADVERTISEMENT DESTINATION URL --------------------------------- */
    destinationUrl: "",

    /* 3. ADVERTISEMENT DESCRIPTION (optional) -------------------------- */
    /* Promotional text shown under the title. Multi-line is supported.
       Leave it empty and no description area is displayed. */
    description: "",

    /* ------------------------------------------------------------------ */
    altText: "إعلان",
    width: 728,
    height: 90,
    displayMode: "contain",
    openInNewTab: true
};
