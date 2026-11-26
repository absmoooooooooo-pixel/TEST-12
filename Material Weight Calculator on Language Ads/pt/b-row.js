/* ==========================================================================
   ROW ADVERTISEMENT — PORTUGUESE — B-ROW
   --------------------------------------------------------------------------
   This ONE file controls the advertisement on the four B-ROW calculators
   in Portuguese:

     1. Circular Plate                           /pt/calculators/circular-plate/
     2. E-Section                                /pt/calculators/e-section/
     3. Round Bar with Hexagonal Hole            /pt/calculators/round-bar-with-hexagonal-hole/
     4. Triangular Bar                           /pt/calculators/triangular-bar/

   WHAT TO EDIT (three fields)
     imageUrl         paste the advertisement image address
     destinationUrl   paste the page a click should open
     enabled          true = show it, false = hide it

   The advertisement appears on ALL FOUR pages above at the same time, in
   Portuguese only. It is shown only when BOTH URLs are valid; leave either
   one empty and nothing is displayed at all — no empty box, no blank space.

   OPTIONAL
     altText         text for screen readers (default: Publicidade)
     width/height    the creative's natural size (default 728 x 90)
     displayMode     "contain" (whole image) or "cover" (fill and crop)
     openInNewTab    true (default) or false
   ========================================================================== */

window.MW_ROW_ADS = window.MW_ROW_ADS || {};
window.MW_ROW_ADS.pt = window.MW_ROW_ADS.pt || {};

window.MW_ROW_ADS.pt["b-row"] = {
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
    altText: "Publicidade",
    width: 728,
    height: 90,
    displayMode: "contain",
    openInNewTab: true
};
