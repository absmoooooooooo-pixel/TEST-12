/* ==================================================
   API CONFIGURATION START
   The website is plain static files, so the calculation API runs on its own
   host. Put that host's URL here, once, and every calculator page uses it.

   Examples:
     window.MW_API_BASE = "";                        // same origin
     window.MW_API_BASE = "https://api.example.com"; // separately deployed API

   This value is optional. Every weight is deterministic and the site ships
   the same verified formulas (assets/js/calc-engine.js), so calculations run
   on the device by default: no request, no data, no delay, offline included.
   To opt into remote answers, set both this and window.MW_API_MODE = "remote"
   before calc-api.js loads. The default stays local even when this URL is set.

   No API key or secret belongs in this file: it is downloaded by the browser.
================================================== */
"use strict";

window.MW_API_BASE = "";

/* ==================================================
   API CONFIGURATION END
   This file ends here.
================================================== */
