/* ==========================================================================
   MATERIAL WEIGHT CALCULATION — SHARED ADVERTISEMENT RENDERER
   --------------------------------------------------------------------------
   One implementation for every calculator page in every language.

   It reads Material-Weight-Calculation-All-Languages-Ads/ads.config.js,
   finds the advertisement assigned to the current calculator and language,
   and mounts the banner in the band between the Calculate / Reset buttons
   and the result card (#results) — so the output always stays below it.

   The banner is mounted once, on page load, and is never removed by
   Calculate or Reset. An advertisement with no image URL renders a clean
   empty placeholder that keeps its reserved space; an advertisement with a
   redirect URL becomes a safe external link, otherwise the image is static.

   Do not add per-page copies of this code: edit ads.config.js instead.
   ========================================================================== */

(function () {
    "use strict";

    var FOLDER = "Material-Weight-Calculation-All-Languages-Ads";
    var LANGUAGES = ["en", "es", "de", "fr", "pt", "zh", "ja", "hi", "mr", "ar"];

    /* The word shown inside an empty box, per page language. */
    var LABELS = {
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
    };

    function config() {
        return window.MW_ADS_CONFIG || {};
    }

    /* ----------------------------------------------------------------------
       Page identity: language folder + calculator slug, both read from the
       address, e.g. /de/calculators/pipe/index.html -> de + pipe and
       /frontend/calculators/plate/index.html      -> en + plate.
    ---------------------------------------------------------------------- */
    function pageContext() {
        var path = (window.location.pathname || "").replace(/\\/g, "/");
        var parts = path.split("/").filter(Boolean);
        var language = "en";

        if (parts.length && LANGUAGES.indexOf(parts[0].toLowerCase()) !== -1) {
            language = parts[0].toLowerCase();
        }

        var calculator = "";
        var marker = "/calculators/";
        var at = path.indexOf(marker);
        if (at !== -1) {
            calculator = path.slice(at + marker.length).split("/")[0];
        }

        return {
            language: language,
            calculator: calculator,
            label: LABELS[language] || LABELS.en
        };
    }

    /* A placement field can be "*", "all", a list, or "en, pt, de". */
    function matches(value, candidate) {
        if (value === undefined || value === null || value === "") return false;
        if (typeof value === "string" && value.indexOf(",") !== -1) {
            value = value.split(",");
        }
        if (typeof value === "string") value = [value];
        if (!value || typeof value.length !== "number") return false;

        for (var i = 0; i < value.length; i += 1) {
            var item = String(value[i]).trim().toLowerCase();
            if (!item) continue;
            if (item === "*" || item === "all") return true;
            if (item === String(candidate).toLowerCase()) return true;
        }
        return false;
    }

    /* Exact matches beat wildcards; the last matching placement wins a tie. */
    function specificity(placement, context) {
        var score = 0;
        if (matches(placement.calculators, context.calculator)) {
            score += String(placement.calculators).toLowerCase().indexOf("*") === -1 ? 2 : 0;
        }
        if (matches(placement.languages, context.language)) {
            score += String(placement.languages).toLowerCase().indexOf("*") === -1 ? 1 : 0;
        }
        return score;
    }

    function adFor(placement) {
        if (!placement) return null;
        var ads = config().ads || {};
        if (placement.ad && typeof placement.ad === "object") return placement.ad;
        if (typeof placement.ad !== "string") return null;
        return ads[placement.ad] || null;
    }

    function resolveAd() {
        var context = pageContext();
        var placements = config().placements || [];
        var best = null;
        var bestAd = null;
        var bestScore = -1;

        for (var i = 0; i < placements.length; i += 1) {
            var placement = placements[i];
            if (!placement || placement.enabled === false) continue;
            if (!context.calculator) continue;
            if (!matches(placement.calculators, context.calculator)) continue;
            if (!matches(placement.languages, context.language)) continue;

            var ad = adFor(placement);
            if (!ad || ad.enabled === false) continue;

            var score = specificity(placement, context);
            if (score >= bestScore) {
                bestScore = score;
                best = placement;
                bestAd = ad;
            }
        }

        return bestAd ? { ad: bestAd, placement: best, context: context } : null;
    }

    /* ----------------------------------------------------------------------
       Helpers
    ---------------------------------------------------------------------- */
    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    /* Accepts http(s), protocol-relative and same-site relative URLs.
       Everything else (javascript:, data:, vbscript:, ...) is rejected. */
    function safeUrl(value, allowRelative) {
        if (typeof value !== "string") return "";
        var url = value.trim();
        if (!url) return "";
        if (/^javascript:|^data:|^vbscript:/i.test(url)) return "";

        if (/^https?:\/\//i.test(url) || /^\/\//.test(url)) {
            try {
                var parsed = new URL(url, window.location.href);
                if (parsed.protocol === "http:" || parsed.protocol === "https:") {
                    return parsed.href;
                }
            } catch (error) {
                return "";
            }
            return "";
        }

        if (allowRelative && /^(\/|\.\/|\.\.\/)/.test(url)) return url;
        return "";
    }

    function sizeFor(ad) {
        var sizes = (config().defaults || {}).sizes || {};
        var size = ad.size;

        if (typeof size === "string" && sizes[size]) return sizes[size];
        if (size && Number(size.width) > 0 && Number(size.height) > 0) {
            return { width: Number(size.width), height: Number(size.height) };
        }
        if (sizes.leaderboard) return sizes.leaderboard;
        return { width: 728, height: 90 };
    }

    function displayModeFor(ad) {
        var mode = String(ad.displayMode || (config().defaults || {}).displayMode || "contain").toLowerCase();
        return mode === "cover" ? "cover" : "contain";
    }

    /* ----------------------------------------------------------------------
       Rendering
    ---------------------------------------------------------------------- */
    function placeholderBox(size, label) {
        var box = element("div", "mw-ad-box is-empty");
        box.style.maxWidth = size.width + "px";
        box.style.aspectRatio = size.width + " / " + size.height;
        box.appendChild(element("span", "mw-ad-empty-text", label));
        return box;
    }

    function buildBanner(ad, context) {
        var size = sizeFor(ad);
        var mode = displayModeFor(ad);
        var imageUrl = safeUrl(ad.imageUrl, true);
        var redirectUrl = safeUrl(ad.redirectUrl, true);
        var label = context.label;

        var banner = element("div", "mw-ad");
        banner.setAttribute("data-mw-ad", "");
        banner.setAttribute("role", "complementary");
        banner.setAttribute("aria-label", label);
        banner.setAttribute("data-mw-ad-language", context.language);
        banner.setAttribute("data-mw-ad-calculator", context.calculator);

        /* No hosted image yet: reserve the configured space, quietly. */
        if (!imageUrl) {
            banner.appendChild(placeholderBox(size, label));
            return banner;
        }

        var box = element("div", "mw-ad-box");
        box.style.maxWidth = size.width + "px";
        if (mode === "cover") {
            box.classList.add("is-cover");
            box.style.aspectRatio = size.width + " / " + size.height;
        }

        var image = element("img", "mw-ad-media");
        image.src = imageUrl;
        image.alt = ad.altText || label;
        image.loading = "lazy";
        image.decoding = "async";
        image.width = size.width;
        image.height = size.height;

        var media = image;
        if (redirectUrl) {
            var link = element("a", "mw-ad-link");
            link.href = redirectUrl;
            link.setAttribute("rel", "noopener noreferrer sponsored");
            link.setAttribute("aria-label", (ad.altText || label) + " — " + label);
            var newTab = (config().defaults || {}).openInNewTab !== false;
            if (newTab) link.target = "_blank";
            link.appendChild(image);
            media = link;
        }

        box.appendChild(media);

        /* A broken image must never leave a half-filled box behind. */
        image.addEventListener("error", function () {
            var fallback = placeholderBox(size, label);
            if (box.parentNode) box.parentNode.replaceChild(fallback, box);
        });

        banner.appendChild(box);
        return banner;
    }

    /* The banner always sits directly above the calculation result card, so
       the order stays: inputs -> Calculate -> Reset -> banner -> results. */
    function mount(banner) {
        var existing = document.querySelectorAll("[data-mw-ad]");
        for (var i = 0; i < existing.length; i += 1) {
            if (existing[i].parentNode) existing[i].parentNode.removeChild(existing[i]);
        }

        var results = document.getElementById("results") || document.querySelector(".card.results");
        if (results && results.parentNode) {
            results.parentNode.insertBefore(banner, results);
            return true;
        }

        var actions = document.querySelector(".actions");
        if (actions && actions.parentNode) {
            actions.parentNode.insertBefore(banner, actions.nextSibling);
            return true;
        }

        var card = document.querySelector(".card");
        if (card && card.parentNode) {
            card.parentNode.insertBefore(banner, card.nextSibling);
            return true;
        }

        return false;
    }

    function render() {
        var context = pageContext();
        if (!context.calculator) return null;

        var resolved = resolveAd();
        /* No advertisement booked for this page: still reserve a clean,
           correctly sized placeholder so the layout is identical everywhere. */
        var ad = resolved ? resolved.ad : {
            imageUrl: "",
            redirectUrl: "",
            size: "leaderboard",
            displayMode: "contain"
        };

        var banner = buildBanner(ad, context);
        if (!mount(banner)) return null;
        return banner;
    }

    function start() {
        if (document.querySelector("[data-mw-ad]")) return;
        render();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }

    /* Small public surface: useful for debugging or a manual re-render. */
    window.MWAds = {
        refresh: render,
        resolve: resolveAd,
        context: pageContext,
        folder: FOLDER
    };
}());
