/* ==================================================
   INTERNET CONNECTION MANAGER
   Small, non-blocking connection notice for optional online features.
   Here is the logic for checking the internet connection.
================================================== */
/*
 * Metal Weight Calculator - global, network-agnostic connection manager.
 *
 * Design goals (mobile data first):
 *   - No Wi-Fi-only rules, no navigator.onLine veto, no connection-type reads.
 *   - No third-party probes. The old version asked Cloudflare, Google and
 *     example.com on every failed check: wasted data, and a blocked public
 *     endpoint could make a perfectly working mobile connection look "offline".
 *   - A local file:// preview has no same-origin HTTP probe to call, so it is
 *     treated as an offline-capable local app and never shows the banner.
 *   - One failed probe is confirmed once before the notice appears, so a
 *     transient DNS/proxy hiccup on a desktop does not flash "offline".
 *   - Never blocks the page. Every calculation runs locally, so a lost
 *     connection only affects optional online extras. User input and history
 *     are never touched.
 *   - Zero background traffic while the connection works. A single tiny
 *     same-origin probe runs only when the browser/native layer signals a
 *     change, when the page becomes visible again, or when the user retries.
 *     After a failed probe it retries every 20 s until the link is back.
 *
 * The public API, the `internetconnectionchange` event and the native bridge
 * are unchanged, so no other component needs to know about this rewrite.
 */
(function () {
    "use strict";

    if (window.InternetConnectionManager) {
        return;
    }

    var SCRIPT_URL = (function () {
        var current = document.currentScript;

        if (current && current.src) {
            return current.src;
        }

        var scripts = document.getElementsByTagName("script");

        for (var i = scripts.length - 1; i >= 0; i -= 1) {
            if (scripts[i].src && scripts[i].src.indexOf("internet-connection-manager.js") !== -1) {
                return scripts[i].src;
            }
        }

        return "";
    })();

    var PROBE_URL = SCRIPT_URL
        ? new URL("connection-check.txt", SCRIPT_URL).href
        : "connection-check.txt";

    var STATUS = {
        UNKNOWN: "unknown",
        ONLINE: "online",
        SERVER_DOWN: "server-down",
        OFFLINE: "offline"
    };

    var PROBE_TIMEOUT_MS = 4000;
    var CONFIRM_DELAY_MS = 1200;
    var RETRY_POLL_MS = 20000;
    var EVENT_THROTTLE_MS = 2500;

    var state = {
        status: STATUS.UNKNOWN,
        online: true,
        verified: false,
        checking: false,
        dialog: "",
        lastCheckedAt: 0,
        lastCheckStartedAt: 0
    };

    var subscribers = [];
    var listeners = [];
    var notice = null;
    var retryButton = null;
    var pollTimer = null;
    var confirmTimer = null;
    var pendingCheck = null;
    var activeController = null;
    var disposed = false;
    var consecutiveFailures = 0;

    /* ---------------------------------------------------------------- *
     * UI: one small, non-blocking banner. No modal, no inert page.
     * ---------------------------------------------------------------- */

    function injectStyles() {
        if (document.getElementById("icm-styles")) {
            return;
        }

        var style = document.createElement("style");
        style.id = "icm-styles";
        style.textContent = [
            ".icm-notice{position:fixed;left:50%;top:12px;z-index:2147482999;display:none;align-items:center;gap:10px;max-width:calc(100% - 24px);margin:0;padding:10px 12px 10px 14px;border:1px solid #f0d9a8;border-radius:12px;background:#fff8e8;box-shadow:0 10px 30px rgba(4,20,24,.16);font:600 13px/1.45 Arial,Helvetica,sans-serif;color:#7a5a10;-webkit-transform:translateX(-50%);transform:translateX(-50%);}",
            ".icm-notice.icm-visible{display:flex;}",
            ".icm-notice[hidden]{display:none !important;}",
            ".icm-notice-text{min-width:0;}",
            ".icm-notice-btn{flex:0 0 auto;padding:7px 12px;border:1px solid #e6c98c;border-radius:8px;background:#fff;font:inherit;color:#7a5a10;cursor:pointer;}",
            ".icm-notice-btn:hover{background:#fff1d6;}"
        ].join("");

        (document.head || document.documentElement).appendChild(style);
    }

    function buildNotice() {
        if (notice) {
            return notice;
        }

        injectStyles();
        notice = document.createElement("div");
        notice.className = "icm-notice";
        notice.id = "icmServerNotice";
        notice.hidden = true;
        notice.setAttribute("role", "status");
        notice.setAttribute("aria-live", "polite");
        notice.innerHTML =
            '<span class="icm-notice-text">Connection problem. Your calculations still work offline.</span>' +
            '<button type="button" class="icm-notice-btn" id="icmNoticeRetry">Retry</button>';
        document.body.appendChild(notice);

        retryButton = notice.querySelector("#icmNoticeRetry");
        retryButton.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            runCheck(true);
        });

        return notice;
    }

    function showNotice() {
        buildNotice();
        if (notice.hidden) {
            notice.hidden = false;
            notice.classList.add("icm-visible");
        }
    }

    function hideNotice() {
        if (notice && !notice.hidden) {
            notice.classList.remove("icm-visible");
            notice.hidden = true;
        }
    }

    /* ---------------------------------------------------------------- *
     * State notification (public API unchanged)
     * ---------------------------------------------------------------- */

    function snapshot() {
        return {
            status: state.status,
            online: state.online,
            verified: state.verified,
            checking: state.checking,
            dialog: state.dialog,
            lastCheckedAt: state.lastCheckedAt
        };
    }

    function notifyNative(detail) {
        var bridge = window.MetalWeightApp;

        if (!bridge || typeof bridge.onConnectionStateChange !== "function") {
            return;
        }

        try {
            bridge.onConnectionStateChange(JSON.stringify({
                status: detail.status,
                online: detail.online,
                dialog: detail.dialog
            }));
        } catch (error) {
            /* advisory only */
        }
    }

    function setState(patch) {
        var key;

        for (key in patch) {
            if (Object.prototype.hasOwnProperty.call(patch, key)) {
                state[key] = patch[key];
            }
        }

        var detail = snapshot();

        for (var i = 0; i < subscribers.length; i += 1) {
            try {
                subscribers[i](detail);
            } catch (error) {
                /* a subscriber must never break the manager */
            }
        }

        if (typeof CustomEvent === "function") {
            try {
                document.dispatchEvent(new CustomEvent("internetconnectionchange", { detail: detail }));
                window.dispatchEvent(new CustomEvent("internetconnectionchange", { detail: detail }));
            } catch (error) {
                /* ignore */
            }
        }

        notifyNative(detail);
    }

    /* ---------------------------------------------------------------- *
     * Probe support: file:// previews and non-HTTP contexts are already
     * local/offline-capable, so there is nothing useful to verify.
     * ---------------------------------------------------------------- */

    function probeSupported() {
        if (typeof fetch !== "function") {
            return false;
        }

        var target;

        try {
            target = new URL(PROBE_URL, document.baseURI || window.location.href);
        } catch (error) {
            return false;
        }

        return target.protocol === "http:" || target.protocol === "https:";
    }

    function markLocalOnly() {
        stopPolling();
        hideNotice();

        if (state.status !== STATUS.ONLINE || state.online !== true ||
            state.verified !== false || state.checking || state.dialog) {
            setState({
                status: STATUS.ONLINE,
                online: true,
                verified: false,
                checking: false,
                dialog: "",
                lastCheckedAt: Date.now()
            });
        }

        return STATUS.ONLINE;
    }

    /* ---------------------------------------------------------------- *
     * Probe: one request, same origin only, bounded in time.
     * ---------------------------------------------------------------- */

    function probe() {
        return new Promise(function (resolve) {
            if (activeController) {
                try { activeController.abort(); } catch (error) { /* ignore */ }
            }

            var controller = typeof AbortController === "function"
                ? new AbortController()
                : null;
            activeController = controller;

            var settled = false;

            function finish(ok) {
                if (settled) {
                    return;
                }

                settled = true;
                window.clearTimeout(timer);

                if (activeController === controller) {
                    activeController = null;
                }

                resolve(ok);
            }

            var timer = window.setTimeout(function () {
                if (controller) {
                    try { controller.abort(); } catch (error) { /* ignore */ }
                }
                finish(false);
            }, PROBE_TIMEOUT_MS);

            var options = { method: "GET", cache: "no-store", credentials: "same-origin" };
            if (controller) {
                options.signal = controller.signal;
            }

            try {
                /* Any HTTP answer proves the path to our own host works. */
                fetch(PROBE_URL + (PROBE_URL.indexOf("?") === -1 ? "?" : "&") + "icm=" + Date.now(), options)
                    .then(function (response) { finish(Boolean(response)); })
                    .catch(function () { finish(false); });
            } catch (error) {
                finish(false);
            }
        });
    }

    function stopPolling() {
        window.clearTimeout(pollTimer);
        window.clearTimeout(confirmTimer);
        pollTimer = null;
        confirmTimer = null;
    }

    function schedulePolling() {
        stopPolling();

        if (disposed || state.status !== STATUS.OFFLINE || document.visibilityState === "hidden") {
            return;
        }

        pollTimer = window.setTimeout(function () {
            pollTimer = null;
            runCheck(false);
        }, RETRY_POLL_MS);
    }

    /* ---------------------------------------------------------------- *
     * Decision
     * ---------------------------------------------------------------- */

    function applyResult(ok) {
        if (ok) {
            consecutiveFailures = 0;
            hideNotice();
            setState({
                status: STATUS.ONLINE,
                online: true,
                verified: true,
                checking: false,
                dialog: "",
                lastCheckedAt: Date.now()
            });
            /* Healthy connection: no background polling at all. */
            stopPolling();
            return STATUS.ONLINE;
        }

        consecutiveFailures += 1;

        /* A single failed fetch is often a desktop DNS/proxy hiccup, not a real
           outage. Confirm once before showing the notice; the confirm probe is
           forced so it is not swallowed by the event throttle. */
        if (consecutiveFailures === 1) {
            setState({
                status: STATUS.UNKNOWN,
                online: true,
                verified: false,
                checking: false,
                dialog: "",
                lastCheckedAt: Date.now()
            });
            stopPolling();
            confirmTimer = window.setTimeout(function () {
                confirmTimer = null;
                runCheck(true);
            }, CONFIRM_DELAY_MS);
            return STATUS.UNKNOWN;
        }

        showNotice();
        setState({
            status: STATUS.OFFLINE,
            online: false,
            verified: true,
            checking: false,
            dialog: "",
            lastCheckedAt: Date.now()
        });
        schedulePolling();
        return STATUS.OFFLINE;
    }

    function runCheck(force) {
        if (disposed) {
            return Promise.resolve(state.status);
        }

        /* A file:// page (or any non-HTTP context) has no same-origin probe to
           call. Calculations are local, so stay online and show no warning. */
        if (!probeSupported()) {
            return Promise.resolve(markLocalOnly());
        }

        if (pendingCheck) {
            if (!force) {
                return pendingCheck;
            }
            return pendingCheck.then(function () { return runCheck(true); });
        }

        var now = Date.now();

        if (!force && (now - state.lastCheckStartedAt < EVENT_THROTTLE_MS)) {
            return Promise.resolve(state.status);
        }

        state.lastCheckStartedAt = now;

        if (!state.checking) {
            setState({ checking: true });
        }

        pendingCheck = probe().then(function (ok) {
            pendingCheck = null;
            return applyResult(ok);
        }, function () {
            pendingCheck = null;
            /* Internal errors must never block the page: fail open. */
            return applyResult(true);
        });

        return pendingCheck;
    }

    /* ---------------------------------------------------------------- *
     * Events
     * ---------------------------------------------------------------- */

    function on(target, type, handler) {
        target.addEventListener(type, handler, { passive: true });
        listeners.push([target, type, handler]);
    }

    function hintedCheck() {
        if (document.visibilityState === "hidden") {
            stopPolling();
            return;
        }
        runCheck(false);
    }

    function nativeSignal() {
        runCheck(false);
    }

    function start() {
        on(window, "online", hintedCheck);
        on(window, "offline", hintedCheck);
        on(window, "focus", hintedCheck);
        on(window, "pageshow", hintedCheck);
        on(document, "visibilitychange", hintedCheck);

        if (navigator.connection && typeof navigator.connection.addEventListener === "function") {
            /* Network type is never read; a hand-over is only a hint. */
            on(navigator.connection, "change", hintedCheck);
        }

        on(window, "metalweightapp:connectivity", nativeSignal);
        on(document, "metalweightapp:connectivity", nativeSignal);

        /* One light check at startup verifies the hint; never blocks the UI. */
        runCheck(false);
    }

    window.InternetConnectionManager = {
        STATUS: STATUS,
        isOnline: function () {
            return state.online;
        },
        getState: snapshot,
        check: function () {
            return runCheck(false).then(snapshot);
        },
        retry: function () {
            return runCheck(true).then(snapshot);
        },
        notifyNativeState: function () {
            return runCheck(true).then(snapshot);
        },
        subscribe: function (callback) {
            if (typeof callback !== "function") {
                return function () {};
            }
            subscribers.push(callback);
            return function () {
                var index = subscribers.indexOf(callback);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
            };
        },
        dispose: function () {
            disposed = true;
            stopPolling();
            if (activeController) {
                try { activeController.abort(); } catch (error) { /* ignore */ }
            }
            for (var i = 0; i < listeners.length; i += 1) {
                listeners[i][0].removeEventListener(listeners[i][1], listeners[i][2]);
            }
            listeners = [];
            hideNotice();
        }
    };

    if (document.body) {
        start();
    } else {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    }
})();

/* ==================================================
   INTERNET CONNECTION MANAGER END
   This JavaScript file ends here.
================================================== */
