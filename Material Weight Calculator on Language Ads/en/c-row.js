/* ==========================================================================
   ROW ADVERTISEMENT — ENGLISH — C-ROW
   --------------------------------------------------------------------------
   This ONE file controls the advertisement on the four C-ROW calculators
   in English:

     1. Flange Plate Weight Calculator           /frontend/calculators/flange-plate/
     2. T Channel                                /frontend/calculators/t-channel/
     3. Trapezium Bar                            /frontend/calculators/trapezium-bar/
     4. Hexagonal Bar with Round Hole            /frontend/calculators/hexagonal-bar-with-round-hole/

   WHAT TO EDIT (three fields)
     imageUrl         paste the advertisement image address
     destinationUrl   paste the page a click should open
     enabled          true = show it, false = hide it

   The advertisement appears on ALL FOUR pages above at the same time, in
   English only. It is shown only when BOTH URLs are valid; leave either
   one empty and nothing is displayed at all — no empty box, no blank space.

   OPTIONAL
     altText         text for screen readers (default: Advertisement)
     width/height    the creative's natural size (default 728 x 90)
     displayMode     "contain" (whole image) or "cover" (fill and crop)
     openInNewTab    true (default) or false
   ========================================================================== */

window.MW_ROW_ADS = window.MW_ROW_ADS || {};
window.MW_ROW_ADS.en = window.MW_ROW_ADS.en || {};

window.MW_ROW_ADS.en["c-row"] = {
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
    altText: "Advertisement",
    width: 728,
    height: 90,
    displayMode: "contain",
    openInNewTab: true
};
