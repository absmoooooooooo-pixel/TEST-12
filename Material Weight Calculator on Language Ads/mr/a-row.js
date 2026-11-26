/* ==========================================================================
   ROW ADVERTISEMENT — MARATHI — A-ROW
   --------------------------------------------------------------------------
   This ONE file controls the advertisement on the four A-ROW calculators
   in Marathi:

     1. Plate                                    /mr/calculators/plate/
     2. C Channel                                /mr/calculators/c-channel/
     3. Solid Round Bar                          /mr/calculators/round-bar/
     4. Square Bar                               /mr/calculators/square-bar/

   WHAT TO EDIT (three fields)
     imageUrl         paste the advertisement image address
     destinationUrl   paste the page a click should open
     enabled          true = show it, false = hide it

   The advertisement appears on ALL FOUR pages above at the same time, in
   Marathi only. It is shown only when BOTH URLs are valid; leave either
   one empty and nothing is displayed at all — no empty box, no blank space.

   OPTIONAL
     altText         text for screen readers (default: जाहिरात)
     width/height    the creative's natural size (default 728 x 90)
     displayMode     "contain" (whole image) or "cover" (fill and crop)
     openInNewTab    true (default) or false
   ========================================================================== */

window.MW_ROW_ADS = window.MW_ROW_ADS || {};
window.MW_ROW_ADS.mr = window.MW_ROW_ADS.mr || {};

window.MW_ROW_ADS.mr["a-row"] = {
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
    altText: "जाहिरात",
    width: 728,
    height: 90,
    displayMode: "contain",
    openInNewTab: true
};
