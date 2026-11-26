/* ==========================================================================
   ROW ADVERTISEMENT — ENGLISH — F-ROW
   --------------------------------------------------------------------------
   This ONE file controls the advertisement on the four F-ROW calculators
   in English:

     1. I Channel                                /frontend/calculators/i-channel/
     2. Dish Ends Calculator                     /frontend/calculators/dish-ends/
     3. Hexagon Bar                              /frontend/calculators/hexagon-bar/
     4. Nut & Bolt Weight Calculator             /frontend/calculators/nut-bolt/

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

window.MW_ROW_ADS.en["f-row"] = {
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
