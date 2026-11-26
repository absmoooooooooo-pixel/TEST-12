/*
 * Metal Weight Calculator - offline-first, low-data service worker.
 *
 * Static files are cached on the device once, then served from that cache:
 * no repeated downloads on mobile data, instant PWA launch, and previously
 * visited calculator pages keep working without a connection.
 *
 * Policies:
 *   - HTML navigation: a cached page is served immediately while a short,
 *     same-origin network refresh updates it. An uncached page always waits
 *     for its real network response, however slow the link is; a different
 *     page is never substituted merely because a request took a few seconds.
 *   - Same-origin static assets: cache first (zero data on repeat visits).
 *   - API / connection probes: never cached, never intercepted. Calculations
 *     run locally, so no calculation ever spends mobile data.
 *   - Cross-origin requests (the optional feedback form) are left alone.
 *
 * To publish a new version, change CACHE_NAME. The old cache is removed on
 * activation and every uncached URL is fetched again.
 */
"use strict";

var CACHE_NAME = "mw-static-v142";
var SCOPE = self.registration ? self.registration.scope : self.location.href;
/* Only used when a cached page already exists. Uncached pages never use a
   deadline, so a slow 2G/3G link still receives the page it asked for. */
var NAVIGATION_TIMEOUT_MS = 2500;

/* Small shared shell. Calculator-specific files are cached on first visit. */
var PRECACHE = [
    "./",
    "./index.html",
    "./manifest.webmanifest",
    "./frontend/favicon.png",
    "./frontend/icons/logo.png",
    "./frontend/assets/css/dashboard.css?v=7",
    "./frontend/calculators/calculator-base.css",
    "./frontend/assets/css/material-grades.css?v=20",
    "./frontend/assets/js/dashboard.js?v=3",
    "./frontend/assets/js/api-config.js",
    "./frontend/assets/js/calc-api.js?v=2",
    "./frontend/assets/js/calc-engine.js?v=1",
    "./frontend/assets/data/dashboard-data.js?v=6",
    "./frontend/assets/data/material-grades-data.js?v=3",
    "./frontend/i18n/number-format.js?v=60",
    "./frontend/i18n/i18n.js?v=60",
    "./frontend/i18n/language-switcher.js?v=60",
    "./frontend/i18n/language-switcher.css?v=60",
    "./frontend/i18n/translations.js?v=60",
    "./frontend/i18n/technical-language.js?v=63",
    "./frontend/shared/internet-connection-manager.js?v=10",
    "./frontend/shared/calculation-history.js?v=28",
    "./frontend/shared/calculation-history.css?v=2",
    "./frontend/shared/smart-install-popup.js?v=2",
    "./frontend/shared/smart-install-popup.css",
    "./frontend/shared/add-shortcut.js?v=3",
    "./frontend/shared/add-shortcut.css",
    "./frontend/shared/contact-details.js?v=6",
    "./frontend/shared/contact-details.css?v=6",
    "./frontend/shared/feedback.js?v=3",
    "./frontend/shared/feedback.css?v=5",
    "./frontend/shared/calculator-sticky-header.css?v=19",
    "./frontend/shared/material-density.js?v=1",
    "./frontend/shared/material-select.js?v=2",
    "./frontend/shared/unit-switch.js?v=5",
    "./frontend/shared/weight-unit.js?v=10",
    "./frontend/shared/formula-unit.js?v=10",
    "./frontend/shared/input-localization.js?v=6",
    "./frontend/shared/number-localize.js?v=6",
    "./frontend/shared/numeric-input.js?v=1",
    "./frontend/shared/weight-unit-placement.js?v=1",
    "./frontend/shared/dimension-values.js?v=2",
    "./frontend/shared/mobile-input-viewport.js",
    "./frontend/shared/numeric-keypad.js?v=5",
    "./frontend/shared/calculator-material-grades.css?v=8",
    "./frontend/shared/calculator-material-grades.js?v=12",
    "./Material Weight Calculator on Language Ads/row-ads.css?v=7",
    "./Material Weight Calculator on Language Ads/row-ads.config.js?v=7",
    "./Material Weight Calculator on Language Ads/row-ads.js?v=7",
    "./frontend/shared/analytics-tracker.js?v=1",
    "./frontend/analytics/analytics.css?v=6",
    "./frontend/analytics/shared.js?v=6",
    "./frontend/analytics/chart.js?v=6",
    "./frontend/analytics/analytics.js?v=6",
    "./frontend/analytics/overview.js?v=6",
    "./frontend/analytics/share/index.html?v=6",
    "./frontend/analytics/share/share.js?v=6"
];

function absolute(path) {
    return new URL(path, SCOPE).href;
}

function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

function cacheable(response, request) {
    return Boolean(
        response &&
        response.ok &&
        response.type === "basic" &&
        request &&
        request.method === "GET"
    );
}

/* ------------------------------------------------------------------ *
 * Install / activate
 * ------------------------------------------------------------------ */

self.addEventListener("install", function (event) {
    event.waitUntil((async function () {
        var cache = await caches.open(CACHE_NAME);

        await Promise.all(PRECACHE.map(function (path) {
            return cache.add(new Request(absolute(path), { cache: "reload" }))
                .catch(function () {
                    /* One missing file must not stop installation. */
                });
        }));

        await self.skipWaiting();
    })());
});

self.addEventListener("activate", function (event) {
    event.waitUntil((async function () {
        var keys = await caches.keys();

        await Promise.all(keys.map(function (key) {
            if (key.indexOf("mw-static-") === 0 && key !== CACHE_NAME) {
                return caches.delete(key);
            }
            return Promise.resolve(false);
        }));

        await self.clients.claim();
    })());
});

self.addEventListener("message", function (event) {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

/* ------------------------------------------------------------------ *
 * Requests
 * ------------------------------------------------------------------ */

function navigationResponse(request) {
    var home = absolute("./index.html");
    var cachePromise = caches.open(CACHE_NAME);

    /* The refresh keeps running after a cached page is returned so a slow
       reply still warms the cache for the next launch. */
    var network = fetch(request).then(function (response) {
        if (!cacheable(response, request)) {
            return response;
        }
        return cachePromise.then(function (cache) {
            return cache.put(request, response.clone()).then(function () {
                return response;
            });
        });
    }).catch(function () {
        return null;
    });

    return cachePromise.then(function (cache) {
        return cache.match(request).then(function (hit) {
            if (hit) {
                /* Already visited: show it at once, refresh in the background.
                   The deadline applies only here, where a cached page exists. */
                return Promise.race([
                    network,
                    sleep(NAVIGATION_TIMEOUT_MS).then(function () { return hit; })
                ]).then(function (response) {
                    return response || hit;
                });
            }

            /* First visit to this page: never replace it with the home page
               just because the connection is slow. Wait for the real response,
               however long it takes, and fall back only if it truly fails. */
            return network.then(function (response) {
                if (response) {
                    return response;
                }
                return cache.match(home).then(function (homePage) {
                    if (homePage) {
                        return homePage;
                    }
                    return new Response(
                        "<!doctype html><meta charset=utf-8><title>Offline</title>" +
                        "<h1>Offline</h1><p>This page has not been cached yet.</p>" +
                        "<p>Your calculations work without internet once a calculator page has been opened.</p>" +
                        "<button onclick='location.reload()'>Retry</button>",
                        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
                    );
                });
            });
        });
    });
}

function assetResponse(request) {
    return caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(request).then(function (hit) {
            if (hit) {
                return hit;
            }

            return fetch(request).then(function (response) {
                if (cacheable(response, request)) {
                    cache.put(request, response.clone());
                }
                return response;
            });
        });
    });
}

self.addEventListener("fetch", function (event) {
    var request = event.request;
    var url;

    if (request.method !== "GET") {
        return; /* calculations are local; API POSTs are never intercepted */
    }

    try {
        url = new URL(request.url);
    } catch (error) {
        return;
    }

    if (url.origin !== self.location.origin) {
        return; /* third-party content (feedback form) stays untouched */
    }

    /* Lightweight connectivity probes must always reach the network. */
    if (url.pathname.indexOf("/api/") !== -1 ||
        url.searchParams.has("icm") ||
        /connection-check\.txt$/.test(url.pathname)) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(navigationResponse(request));
        return;
    }

    if (url.protocol === "http:" || url.protocol === "https:") {
        event.respondWith(assetResponse(request).catch(function () {
            return fetch(request);
        }));
    }
});
