/* ==========================================================================
   MATERIAL WEIGHT CALCULATOR — ROW ADVERTISEMENT CARD RENDERER
   --------------------------------------------------------------------------
   One shared implementation for every calculator page in every language.

   What it does
     1. Reads the language and calculator from the page address.
     2. Finds which Row that calculator belongs to (row-ads.config.js).
     3. Loads only that language's Row file, e.g. en/a-row.js.
     4. Shows a compact advertisement card between the Reset button and the
        result card when the Row file has a valid image URL and destination.

   The card uses the same .card shell as Material Grades / Material Selection,
   so it always matches the page's content width. A green ribbon identifies it
   as an advertisement, and the layout adapts to the creative itself: banner,
   landscape, square and portrait images each get a frame that matches their
   own aspect ratio, so the image fills the space instead of floating in an
   empty box. The whole card is one link to the configured destination, and an
   optional Advertisement Description is shown whenever the Row file has one.

   It never inserts anything when the Row file is empty, disabled, or has an
   invalid URL: no empty frame, no reserved blank space.

   Do not copy this code into pages. Publish an advertisement by editing the
   Row file for the language you want.
   ========================================================================== */

(function () {
    "use strict";

    var VERSION = "3";
    var scriptEl = document.currentScript;
    var BASE = "";

    if (scriptEl && scriptEl.src) {
        /* .../Material Weight Calculator on Language Ads/row-ads.js -> folder */
        BASE = scriptEl.src.split("?")[0].replace(/[^/]*$/, "");
    } else {
        BASE = "/Material Weight Calculator on Language Ads/";
    }

    function config() {
        return window.MW_ROW_ADS_CONFIG || {};
    }

    function defaults() {
        return config().defaults || {};
    }

    /* ----------------------------------------------------------------------
       Page identity
    ---------------------------------------------------------------------- */
    function pageContext() {
        var cfg = config();
        var languages = cfg.languages || ["en"];
        var path = (window.location.pathname || "").replace(/\\/g, "/");
        var parts = path.split("/").filter(Boolean);
        var language = cfg.defaultLanguage || "en";

        if (parts.length && languages.indexOf(parts[0].toLowerCase()) !== -1) {
            language = parts[0].toLowerCase();
        }

        var calculator = "";
        var at = path.indexOf("/calculators/");
        if (at !== -1) {
            calculator = path.slice(at + "/calculators/".length).split("/")[0];
        }

        var labels = cfg.labels || {};
        return {
            language: language,
            calculator: calculator,
            row: rowFor(calculator),
            label: labels[language] || labels.en || "Advertisement"
        };
    }

    function rowFor(calculator) {
        if (!calculator) return "";
        var map = config().calculators || {};
        var rows = config().rows || Object.keys(map);

        for (var i = 0; i < rows.length; i += 1) {
            var list = map[rows[i]] || [];
            for (var j = 0; j < list.length; j += 1) {
                if (String(list[j]).toLowerCase() === calculator.toLowerCase()) {
                    return rows[i];
                }
            }
        }
        return "";
    }

    /* ----------------------------------------------------------------------
       URL validation
       Accepted: http(s)://, protocol-relative //host/path, and same-site
       paths starting with /, ./ or ../. Everything else (javascript:, data:,
       vbscript:, bare words) is rejected.
    ---------------------------------------------------------------------- */
    function safeUrl(value) {
        if (typeof value !== "string") return "";
        var url = value.trim();
        if (!url) return "";

        if (/^(javascript|data|vbscript|file|blob):/i.test(url)) return "";

        if (/^https?:\/\//i.test(url)) {
            try {
                var parsed = new URL(url);
                if (parsed.protocol === "http:" || parsed.protocol === "https:") {
                    return parsed.href;
                }
            } catch (error) {
                return "";
            }
            return "";
        }

        if (/^\/\//.test(url)) {
            return (window.location.protocol === "https:" ? "https:" : "http:") + url;
        }

        if (/^\/(?!\/)/.test(url) || /^\.\.?\//.test(url)) return url;

        return "";
    }

    /* ----------------------------------------------------------------------
       Small text/label helpers
    ---------------------------------------------------------------------- */
    function clean(value) {
        if (value === undefined || value === null) return "";
        return String(value).trim();
    }

    function uiLabel(context, key, fallback) {
        var ui = config().ui || {};
        var current = ui[context.language] || {};
        return clean(current[key]) || clean(ui.en && ui.en[key]) || fallback;
    }

    function ctaText(ad, context) {
        var custom = clean(ad.ctaText);
        if (custom) return custom;

        var ctas = config().ctaLabels || {};
        return clean(ctas[context.language]) || clean(ctas.en) || "Click Here →";
    }

    function phoneHref(value) {
        var compact = clean(value).replace(/[\s().-]/g, "");
        if (!/^\+?[0-9][0-9]{4,14}$/.test(compact)) return "";
        return "tel:" + compact;
    }

    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    function addText(parent, tag, className, value) {
        var content = clean(value);
        if (!content) return null;
        var node = element(tag, className, content);
        parent.appendChild(node);
        return node;
    }

    /* ----------------------------------------------------------------------
       Row file loading: only the current language + Row is fetched.
    ---------------------------------------------------------------------- */
    function loadRowFile(language, row, done) {
        var store = window.MW_ROW_ADS || {};
        if (store[language] && store[language][row]) {
            done();
            return;
        }

        var script = document.createElement("script");
        script.src = BASE + language + "/" + row + ".js?v=" + VERSION;
        script.async = true;
        script.onload = done;
        script.onerror = done;
        document.head.appendChild(script);
    }

    /* ----------------------------------------------------------------------
       Rendering
    ---------------------------------------------------------------------- */
    function number(value, fallback) {
        var parsed = Number(value);
        return parsed > 0 ? parsed : fallback;
    }

    /* ----------------------------------------------------------------------
       Image format
       The creative's own proportions decide the card layout, so a wide banner,
       a logo and a portrait poster each look intentional instead of being
       forced into one fixed box.
    ---------------------------------------------------------------------- */
    var FORMATS = ["banner", "landscape", "square", "portrait"];

    function formatFor(width, height) {
        var w = Number(width);
        var h = Number(height);
        var ratio = w > 0 && h > 0 ? w / h : 728 / 90;
        if (ratio >= 2.6) return "banner";
        if (ratio >= 1.35) return "landscape";
        if (ratio >= 0.85) return "square";
        return "portrait";
    }

    function applyFormat(banner, width, height) {
        var format = formatFor(width, height);
        for (var i = 0; i < FORMATS.length; i += 1) {
            banner.classList.remove("mw-row-ad--" + FORMATS[i]);
        }
        banner.classList.add("mw-row-ad--" + format);
        banner.setAttribute("data-mw-format", format);
        if (width > 0 && height > 0) {
            banner.style.setProperty("--mw-ad-ar", width + " / " + height);
            banner.style.setProperty("--mw-ad-ratio", String(Number((width / height).toFixed(4))));
        }
    }

    function buildInfo(ad, context) {
        var info = element("div", "mw-row-ad__info");
        var business = clean(ad.businessName);
        var title = clean(ad.title);

        /* Business name and title share the heading area. When both exist,
           the business name is a small eyebrow above the advertisement title. */
        if (title) {
            addText(info, "span", "mw-row-ad__business", business);
            addText(info, "h3", "mw-row-ad__title", title);
        } else if (business) {
            addText(info, "h3", "mw-row-ad__title", business);
        }

        /* Advertisement Description: optional promotional text. Nothing is
           created when it is empty, so no blank gap is left behind. */
        addText(info, "p", "mw-row-ad__description", ad.description);
        addText(info, "p", "mw-row-ad__business-info", ad.businessInfo);

        var contact = clean(ad.contactNumber || ad.phone);
        var website = safeUrl(clean(ad.websiteUrl || ad.website));
        var meta = null;
        var item = null;
        var link = null;

        if (contact || website) {
            meta = element("div", "mw-row-ad__meta");

            if (contact) {
                item = element("span", "mw-row-ad__meta-item");
                item.appendChild(element("span", "mw-row-ad__meta-label", uiLabel(context, "contact", "Contact")));
                var tel = phoneHref(contact);
                if (tel) {
                    link = element("a", "mw-row-ad__meta-link", contact);
                    link.href = tel;
                    item.appendChild(link);
                } else {
                    item.appendChild(element("span", "", contact));
                }
                meta.appendChild(item);
            }

            if (website) {
                item = element("span", "mw-row-ad__meta-item");
                item.appendChild(element("span", "mw-row-ad__meta-label", uiLabel(context, "website", "Website")));
                link = element("a", "mw-row-ad__meta-link", clean(ad.websiteUrl || ad.website).replace(/^https?:\/\//i, "").replace(/\/$/, ""));
                link.href = website;
                link.setAttribute("rel", "noopener noreferrer sponsored");
                if (defaults().openInNewTab !== false) link.target = "_blank";
                item.appendChild(link);
                meta.appendChild(item);
            }

            info.appendChild(meta);
        }

        /* The whole card is already the link, so the call to action is a
           styled span with no href of its own: nothing is nested and no
           second click handler can fight with the card link. It always sits
           inside the same card, so it opens the configured destination. */
        var cta = element("span", "mw-row-ad__cta", ctaText(ad, context));
        cta.setAttribute("aria-hidden", "true");
        info.appendChild(cta);

        return info;
    }

    function buildBanner(ad, context) {
        var defs = defaults();
        var declaredWidth = number(ad.width, number(defs.width, 728));
        var declaredHeight = number(ad.height, number(defs.height, 90));
        var mode = String(ad.displayMode || defs.displayMode || "contain").toLowerCase() === "cover"
            ? "cover"
            : "contain";
        var imageUrl = safeUrl(ad.imageUrl);
        var destinationUrl = safeUrl(ad.destinationUrl);
        var heading = clean(ad.title) || clean(ad.businessName);
        var altText = clean(ad.altText) || heading || context.label;
        var newTab = ad.openInNewTab !== undefined ? ad.openInNewTab !== false : defs.openInNewTab !== false;

        /* Same .card shell and alignment as Material Grades / Material
           Selection, so the advertisement matches the page content width. */
        var banner = document.createElement("div");
        banner.className = "card mw-row-ad" + (mode === "cover" ? " is-cover" : "");
        banner.setAttribute("data-mw-row-ad", "");
        banner.setAttribute("data-mw-row", context.row);
        banner.setAttribute("data-mw-language", context.language);
        banner.setAttribute("data-mw-calculator", context.calculator);
        banner.setAttribute("role", "complementary");
        banner.setAttribute("aria-label", context.label);
        applyFormat(banner, declaredWidth, declaredHeight);

        /* Green ribbon: the identification label, styled as part of the card. */
        var ribbon = element("div", "mw-row-ad__ribbon");
        ribbon.appendChild(element("span", "mw-row-ad__ribbon-mark"));
        ribbon.appendChild(element("span", "mw-row-ad__ribbon-text", context.label));
        banner.appendChild(ribbon);

        var body = element("div", "mw-row-ad__body");
        var media = element("div", "mw-row-ad__media");

        var image = element("img", "mw-row-ad__image");
        image.src = imageUrl;
        image.alt = altText;
        image.loading = "lazy";
        image.decoding = "async";
        /* width/height are only set for the legacy "cover" mode. In the
           default mode the frame follows the image's own ratio, so nothing is
           stretched, cropped or squeezed into a fixed box. */
        if (mode === "cover") {
            image.width = declaredWidth;
            image.height = declaredHeight;
        }

        /* The declared size is only a hint: once the image loads, its real
           proportions choose (or correct) the layout, so any image format
           works without editing code. */
        image.addEventListener("load", function () {
            var naturalWidth = image.naturalWidth || declaredWidth;
            var naturalHeight = image.naturalHeight || declaredHeight;
            applyFormat(banner, naturalWidth, naturalHeight);
        });

        /* A broken image must leave no blank space behind. */
        image.addEventListener("error", function () {
            if (banner.parentNode) banner.parentNode.removeChild(banner);
        });

        media.appendChild(image);
        body.appendChild(media);
        body.appendChild(buildInfo(ad, context));
        banner.appendChild(body);

        /* One link for the whole card: image, description, ribbon and button
           all open the configured destination. It is a sibling overlay, so
           there are no nested links and no competing click handlers. */
        var hit = element("a", "mw-row-ad__hit");
        hit.href = destinationUrl;
        hit.setAttribute("rel", "noopener noreferrer sponsored");
        hit.setAttribute("aria-label", context.label + ": " + (heading || altText));
        if (newTab) hit.target = "_blank";
        banner.appendChild(hit);

        return banner;
    }

    /* Sits directly above the result card, so the order stays:
       inputs -> Calculate -> Reset -> advertisement -> results. */
    function mount(banner) {
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

    function clear() {
        var existing = document.querySelectorAll("[data-mw-row-ad], [data-mw-ad]");
        for (var i = 0; i < existing.length; i += 1) {
            if (existing[i].parentNode) existing[i].parentNode.removeChild(existing[i]);
        }
    }

    function resolve() {
        var context = pageContext();
        if (!context.calculator || !context.row) return null;

        var store = window.MW_ROW_ADS || {};
        var languageAds = store[context.language];
        if (!languageAds) return null;

        var ad = languageAds[context.row];
        if (!ad || ad.enabled === false) return null;

        var imageUrl = safeUrl(ad.imageUrl);
        var destinationUrl = safeUrl(ad.destinationUrl);
        if (!imageUrl || !destinationUrl) return null;

        return { ad: ad, context: context };
    }

    function render() {
        clear();

        var context = pageContext();
        if (!context.calculator || !context.row) return null;

        loadRowFile(context.language, context.row, function () {
            var resolved = resolve();
            if (!resolved) return;

            var banner = buildBanner(resolved.ad, resolved.context);
            if (!mount(banner)) return;

            document.dispatchEvent(new CustomEvent("mw:row-ad-rendered", {
                detail: {
                    row: resolved.context.row,
                    language: resolved.context.language,
                    calculator: resolved.context.calculator
                }
            }));
        });

        return context;
    }

    function start() {
        render();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }

    /* Small public surface for debugging and manual refreshes. */
    window.MWRowAds = {
        refresh: render,
        resolve: resolve,
        context: pageContext,
        rowFor: rowFor,
        base: BASE
    };
}());
