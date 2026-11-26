/* ==========================================================================
   ROW ADVERTISEMENT — ENGLISH — A-ROW
   --------------------------------------------------------------------------
   This ONE file controls the advertisement on the four A-ROW calculators
   in English:

     1. Plate                                    /frontend/calculators/plate/
     2. C Channel                                /frontend/calculators/c-channel/
     3. Solid Round Bar                          /frontend/calculators/round-bar/
     4. Square Bar                               /frontend/calculators/square-bar/

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

window.MW_ROW_ADS.en["a-row"] = {
    enabled: true,

    /* 1. ADVERTISEMENT IMAGE URL --------------------------------------- */
    imageUrl: "https://ts3.mm.bing.net/th?id=OIP.huhpKtaPrZtO3plwjywBdwHaF6&pid=15.1",

    /* 2. ADVERTISEMENT DESTINATION URL --------------------------------- */
    destinationUrl: "https://jadhavengineering.xyz/",

    /* 3. ADVERTISEMENT DESCRIPTION (optional) -------------------------- */
    /* Promotional text shown under the title. Multi-line is supported.
       Leave it empty and no description area is displayed. */
    description: "Jadhav Engineering provides professional engineering design, " +
        "fabrication, and industrial solutions. Contact us for reliable " +
        "engineering services.",

    /* Business name shown above the description. */
    businessName: "Jadhav Engineering",

    /* ------------------------------------------------------------------ */
    altText: "Advertisement",
    width: 728,
    height: 90,
    displayMode: "contain",
    openInNewTab: true,

    /* ------------------------------------------------------------------
       OPTIONAL CARD CONTENT — add only details supplied by the advertiser.
       Leave a value out or empty and that part is not displayed at all.

       businessName: "",
       title: "",
       description: "",
       businessInfo: "",
       contactNumber: "",
       websiteUrl: "",
       ctaText: ""
       ------------------------------------------------------------------ */
};
