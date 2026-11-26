/* ==========================================================================
   ROW ADVERTISEMENT — CHINESE — D-ROW
   --------------------------------------------------------------------------
   This ONE file controls the advertisement on the four D-ROW calculators
   in Chinese:

     1. Sphere / Ball                            /zh/calculators/sphere-ball/
     2. Pipe                                     /zh/calculators/pipe/
     3. Trapezoidal Bar                          /zh/calculators/trapezoidal-bar/
     4. Solid Cone                               /zh/calculators/solid-cone/

   WHAT TO EDIT (three fields)
     imageUrl         paste the advertisement image address
     destinationUrl   paste the page a click should open
     enabled          true = show it, false = hide it

   The advertisement appears on ALL FOUR pages above at the same time, in
   Chinese only. It is shown only when BOTH URLs are valid; leave either
   one empty and nothing is displayed at all — no empty box, no blank space.

   OPTIONAL
     altText         text for screen readers (default: 广告)
     width/height    the creative's natural size (default 728 x 90)
     displayMode     "contain" (whole image) or "cover" (fill and crop)
     openInNewTab    true (default) or false
   ========================================================================== */

window.MW_ROW_ADS = window.MW_ROW_ADS || {};
window.MW_ROW_ADS.zh = window.MW_ROW_ADS.zh || {};

window.MW_ROW_ADS.zh["d-row"] = {
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
    altText: "广告",
    width: 728,
    height: 90,
    displayMode: "contain",
    openInNewTab: true
};
