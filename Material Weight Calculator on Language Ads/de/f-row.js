/* ==========================================================================
   ROW ADVERTISEMENT — GERMAN — F-ROW
   --------------------------------------------------------------------------
   This ONE file controls the advertisement on the four F-ROW calculators
   in German:

     1. I Channel                                /de/calculators/i-channel/
     2. Dish Ends Calculator                     /de/calculators/dish-ends/
     3. Hexagon Bar                              /de/calculators/hexagon-bar/
     4. Nut & Bolt Weight Calculator             /de/calculators/nut-bolt/

   WHAT TO EDIT (three fields)
     imageUrl         paste the advertisement image address
     destinationUrl   paste the page a click should open
     enabled          true = show it, false = hide it

   The advertisement appears on ALL FOUR pages above at the same time, in
   German only. It is shown only when BOTH URLs are valid; leave either
   one empty and nothing is displayed at all — no empty box, no blank space.

   OPTIONAL
     altText         text for screen readers (default: Werbung)
     width/height    the creative's natural size (default 728 x 90)
     displayMode     "contain" (whole image) or "cover" (fill and crop)
     openInNewTab    true (default) or false
   ========================================================================== */

window.MW_ROW_ADS = window.MW_ROW_ADS || {};
window.MW_ROW_ADS.de = window.MW_ROW_ADS.de || {};

window.MW_ROW_ADS.de["f-row"] = {
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
    altText: "Werbung",
    width: 728,
    height: 90,
    displayMode: "contain",
    openInNewTab: true
};
