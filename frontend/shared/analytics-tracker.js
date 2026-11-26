/* ==========================================================================
   ROW ANALYTICS — FIRST-PARTY EVENT TRACKER
   --------------------------------------------------------------------------
   One shared file for every page in every language. It records four events:

     calculator_click   a calculator card on a home page was clicked
     calculator_view    a calculator page finished loading
     ad_impression      a Row advertisement was actually displayed
     ad_click           a Row advertisement was clicked

   Every event is always attributed to the CANONICAL calculator and Row from
   row-ads.config.js, never to a language copy: a Spanish Plate page reports
   calculator "plate" in Row "a-row" with locale "es". One calculator, one
   identity, whatever the language.

   Duplicate protection
     - Each event carries a unique eventInstanceId; the server stores at most
       one record per id, so a beacon that is delivered twice is counted once.
     - Views and impressions are limited once per 30 minutes per device and
       calculator/Row, so a reload or a redirect never inflates them.
     - Clicks are counted per activation; clicking twice counts twice.

   The tracker never blocks navigation and never changes a page. If the
   analytics API is not deployed or is unreachable the events are simply lost:
   calculators keep working exactly as before.

   Configuration
     window.MW_API_BASE              same API base as calc-api.js (optional)
     window.MW_ANALYTICS_ENDPOINT    explicit override for /api/analytics
   ========================================================================== */

(function () {
    "use strict";

    var CONFIG = window.MW_ROW_ADS_CONFIG || {};
    var LANGUAGES = Array.isArray(CONFIG.languages) ? CONFIG.languages : ["en"];
    var ROW_MAP = CONFIG.calculators || {};
    var DEFAULT_LANGUAGE = CONFIG.defaultLanguage || "en";

    var VIEW_WINDOW_MS = 30 * 60 * 1000;
    var IMPRESSION_WINDOW_MS = 30 * 60 * 1000;

    var sentThisPage = {};

    /* ----------------------------------------------------------------------
       Small storage helpers — private mode can throw, so every call is safe.
    ---------------------------------------------------------------------- */
    function readStore(store, key) {
        try {
            return store.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function writeStore(store, key, value) {
        try {
            store.setItem(key, value);
        } catch (error) {
            /* Storage unavailable: dedupe falls back to the server. */
        }
    }

    function uuid() {
        try {
            if (window.crypto && typeof window.crypto.randomUUID === "function") {
                return window.crypto.randomUUID();
            }
            if (window.crypto && window.crypto.getRandomValues) {
                var bytes = new Uint8Array(16);
                window.crypto.getRandomValues(bytes);
                var hex = "";
                for (var i = 0; i < bytes.length; i += 1) {
                    hex += (bytes[i] + 256).toString(16).slice(1);
                }
                return hex;
            }
        } catch (error) {
            /* Fall through to the random id below. */
        }
        return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
    }

    /* A random, first-party device id. It contains no personal information and
       the server stores only a hash of it; it exists so views and impressions
       can be deduplicated across page reloads. */
    function visitorId() {
        var key = "mw-an-visitor";
        var existing = readStore(window.localStorage, key);
        if (existing) return existing;
        var created = uuid();
        writeStore(window.localStorage, key, created);
        return created;
    }

    /* ----------------------------------------------------------------------
       Page identity
    ---------------------------------------------------------------------- */
    function pageContext() {
        var path = (window.location.pathname || "").replace(/\\/g, "/");
        var parts = path.split("/").filter(Boolean);
        var locale = String(document.documentElement.lang || "").toLowerCase().slice(0, 2);

        if (LANGUAGES.indexOf(locale) === -1) {
            locale = DEFAULT_LANGUAGE;
        }

        var calculator = "";
        var at = path.indexOf("/calculators/");
        if (at !== -1) {
            calculator = path.slice(at + "/calculators/".length).split("/")[0];
        }

        /* /es/calculators/plate/ -> locale es.
           /frontend/calculators/plate/ -> locale en (the folder is the app
           directory, not a language). A repository sub-path such as
           /repo/es/calculators/plate/ still resolves to es. */
        var calculatorsAt = parts.indexOf("calculators");
        if (calculatorsAt > 0) {
            var segment = parts[calculatorsAt - 1].toLowerCase();
            if (LANGUAGES.indexOf(segment) !== -1) {
                locale = segment;
            } else if (segment === "frontend") {
                locale = DEFAULT_LANGUAGE;
            }
        } else if (LANGUAGES.indexOf(parts[0]) !== -1) {
            locale = parts[0].toLowerCase();
        }

        return {
            locale: locale,
            calculator: calculator,
            row: rowFor(calculator)
        };
    }

    function rowFor(calculator) {
        if (!calculator) return "";
        var rows = Object.keys(ROW_MAP);
        for (var i = 0; i < rows.length; i += 1) {
            var list = ROW_MAP[rows[i]] || [];
            for (var j = 0; j < list.length; j += 1) {
                if (String(list[j]).toLowerCase() === String(calculator).toLowerCase()) {
                    return rows[i];
                }
            }
        }
        return "";
    }

    function currentPath() {
        return (window.location.pathname || "").replace(/\\/g, "/").slice(0, 200);
    }

    /* ----------------------------------------------------------------------
       Delivery — text/plain keeps the request a "simple" CORS request, so a
       static page on another origin can post without a preflight. The server
       parses the body as JSON.
    ---------------------------------------------------------------------- */
    function collectUrl() {
        var base = window.MW_ANALYTICS_ENDPOINT || window.MW_API_BASE || "";
        return String(base).replace(/\/+$/, "") + "/api/analytics/collect";
    }

    function send(event) {
        var body;
        try {
            body = JSON.stringify(event);
        } catch (error) {
            return;
        }

        var url = collectUrl();

        try {
            if (navigator.sendBeacon) {
                var blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
                if (navigator.sendBeacon(url, blob)) return;
            }
        } catch (error) {
            /* Beacon refused: try a keepalive request below. */
        }

        try {
            fetch(url, {
                method: "POST",
                body: body,
                headers: { "Content-Type": "text/plain;charset=UTF-8" },
                credentials: "omit",
                keepalive: true
            }).catch(function () {
                /* Analytics must never surface an error to the visitor. */
            });
        } catch (error) {
            /* No fetch available: the event is dropped, the page is unaffected. */
        }
    }

    function track(type, fields) {
        var context = pageContext();

        send({
            type: type,
            calculator: fields.calculator || context.calculator,
            row: fields.row || context.row,
            locale: fields.locale || context.locale,
            campaignId: fields.campaignId || null,
            path: currentPath(),
            eventInstanceId: uuid(),
            visitorId: visitorId()
        });
    }

    /* ----------------------------------------------------------------------
       Dedupe helpers
    ---------------------------------------------------------------------- */
    function once(key) {
        if (sentThisPage[key]) return false;
        sentThisPage[key] = true;
        return true;
    }

    /* True when the same thing was already recorded recently on this device.
       Records the time otherwise. */
    function recently(key, windowMs) {
        var last = Number(readStore(window.localStorage, key) || 0);
        if (last && Date.now() - last < windowMs) return true;
        writeStore(window.localStorage, key, String(Date.now()));
        return false;
    }

    /* ----------------------------------------------------------------------
       Calculator view — sent once the page has actually loaded.
    ---------------------------------------------------------------------- */
    function trackCalculatorView() {
        var context = pageContext();
        if (!context.calculator || !context.row) return;
        if (!once("view")) return;
        if (recently("mw-an:view:" + context.calculator, VIEW_WINDOW_MS)) return;

        track("calculator_view", {
            calculator: context.calculator,
            row: context.row,
            locale: context.locale
        });
    }

    /* ----------------------------------------------------------------------
       Advertisement impression — the Row renderer announces a mounted banner.
    ---------------------------------------------------------------------- */
    function trackAdImpression(ad, context) {
        var page = pageContext();
        var row = (context && context.row) || page.row;
        var calculator = (context && context.calculator) || page.calculator;
        if (!row || !calculator) return;

        var campaignId = (ad && ad.campaignId) || "row-" + row;
        var key = "mw-an:imp:" + row + ":" + campaignId;

        if (!once("impression:" + key)) return;
        if (recently(key, IMPRESSION_WINDOW_MS)) return;

        track("ad_impression", {
            calculator: calculator,
            row: row,
            locale: (context && context.language) || page.locale,
            campaignId: campaignId
        });
    }

    function resolvedAd() {
        try {
            if (window.MWRowAds && typeof window.MWRowAds.resolve === "function") {
                return window.MWRowAds.resolve();
            }
        } catch (error) {
            /* The ad system is optional. */
        }
        return null;
    }

    /* ----------------------------------------------------------------------
       Clicks
    ---------------------------------------------------------------------- */
    function onDocumentClick(event) {
        var target = event.target;
        if (!target || typeof target.closest !== "function") return;

        var adLink = target.closest("[data-mw-row-ad] a");
        if (adLink) {
            var resolved = resolvedAd();
            var page = pageContext();
            var row = (resolved && resolved.context && resolved.context.row) || page.row;
            var calculator =
                (resolved && resolved.context && resolved.context.calculator) || page.calculator;
            if (!row || !calculator) return;

            /* Navigation is never prevented: the link opens its configured
               destination exactly as before, the click is just recorded. */
            track("ad_click", {
                row: row,
                calculator: calculator,
                locale: (resolved && resolved.context && resolved.context.language) || page.locale,
                campaignId: (resolved && resolved.ad && resolved.ad.campaignId) || "row-" + row
            });
            return;
        }

        var card = target.closest("a[data-tool-id]");
        if (!card) return;

        var calculatorId = card.getAttribute("data-tool-id");
        var rowId = rowFor(calculatorId);
        if (!calculatorId || !rowId) return;

        track("calculator_click", {
            calculator: calculatorId,
            row: rowId,
            locale: pageContext().locale
        });
    }

    /* ----------------------------------------------------------------------
       Wire up
    ---------------------------------------------------------------------- */
    function start() {
        trackCalculatorView();

        /* The banner may already be on the page when this file runs later than
           the renderer (for example after a cached visit). */
        var banner = document.querySelector("[data-mw-row-ad]");
        if (banner) {
            var resolved = resolvedAd();
            if (resolved) {
                trackAdImpression(resolved.ad, resolved.context);
            } else {
                trackAdImpression(
                    null,
                    {
                        row: banner.getAttribute("data-mw-row"),
                        calculator: banner.getAttribute("data-mw-calculator"),
                        language: banner.getAttribute("data-mw-language")
                    }
                );
            }
        }

        document.addEventListener("click", onDocumentClick, true);
    }

    document.addEventListener("mw:row-ad-rendered", function () {
        var resolved = resolvedAd();
        if (resolved) {
            trackAdImpression(resolved.ad, resolved.context);
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }

    /* Debugging surface, also used by the dashboard walkthrough. */
    window.MWAnalytics = {
        track: track,
        context: pageContext,
        rowFor: rowFor,
        endpoint: collectUrl
    };
}());
