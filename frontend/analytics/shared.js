/* Analytics shared helpers - no dependencies. */
(function (window) {
    "use strict";

    var KEY_NAME = "mw-an-key";

    function isoDate(d) { return d.toISOString().slice(0, 10); }
    function isoToday() { return isoDate(new Date()); }
    function isoDaysAgo(days) {
        var d = new Date();
        d.setUTCDate(d.getUTCDate() - days);
        return isoDate(d);
    }
    function isoLastMonthRange() {
        var now = new Date();
        var firstThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        var lastPrev = new Date(firstThisMonth.getTime() - 24 * 60 * 60 * 1000);
        var firstPrev = new Date(Date.UTC(lastPrev.getUTCFullYear(), lastPrev.getUTCMonth(), 1));
        return { from: isoDate(firstPrev), to: isoDate(lastPrev) };
    }
    function isIsoDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }

    function presetRange(preset) {
        var today = isoToday();
        if (preset === "7d") return { from: isoDaysAgo(6), to: today };
        if (preset === "30d") return { from: isoDaysAgo(29), to: today };
        if (preset === "last-month") return isoLastMonthRange();
        if (preset === "all") return { from: "2020-01-01", to: today };
        return null;
    }

    function apiBase() { return String(window.MW_API_BASE || "").replace(/\/+$/, ""); }

    function readKey() {
        try { return window.sessionStorage.getItem(KEY_NAME) || ""; } catch (e) { return ""; }
    }
    function saveKey(value) {
        try { window.sessionStorage.setItem(KEY_NAME, value); } catch (e) { /* ignore */ }
    }

    function fetchJson(url, options) {
        var opts = options || {};
        opts.credentials = "omit";
        opts.cache = "no-store";
        return fetch(url, opts).then(function (res) {
            return res.json().catch(function () { return null; }).then(function (payload) {
                return { status: res.status, payload: payload };
            });
        });
    }

    function fetchReport(endpoint, params, key) {
        var search = new URLSearchParams();
        search.set("from", params.from);
        search.set("to", params.to);
        var headers = {};
        if (key) headers["x-api-key"] = key;
        return fetchJson(apiBase() + endpoint + "?" + search.toString(), { headers: headers });
    }

    function postJson(endpoint, body, key) {
        var headers = { "Content-Type": "application/json" };
        if (key) headers["x-api-key"] = key;
        return fetchJson(apiBase() + endpoint, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body || {})
        });
    }

    function escapeHtml(value) {
        return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function number(value) {
        var n = Number(value);
        if (!Number.isFinite(n)) return "0";
        return new Intl.NumberFormat("en-US").format(n);
    }

    function compact(value) {
        var n = Number(value);
        if (!Number.isFinite(n)) return "0";
        var abs = Math.abs(n);
        if (abs >= 1000000) return (n / 1000000).toFixed(abs >= 10000000 ? 0 : 1) + "M";
        if (abs >= 1000) return (n / 1000).toFixed(abs >= 10000 ? 0 : 1) + "k";
        return String(Math.round(n));
    }

    function trendBadge(trend) {
        if (!trend) return '<span class="an-trend an-trend--flat" aria-label="Stable">— Stable</span>';
        var dir = trend.direction;
        if (dir === "up") return '<span class="an-trend an-trend--up" aria-label="Increasing">▲ Up</span>';
        if (dir === "down") return '<span class="an-trend an-trend--down" aria-label="Decreasing">▼ Down</span>';
        return '<span class="an-trend an-trend--flat" aria-label="Stable">— Stable</span>';
    }

    function trendDetail(trend) {
        if (!trend) return "";
        var pct = trend.changePercent;
        var sign = pct > 0 ? "+" : "";
        return sign + pct + "% vs previous period";
    }

    /* Compact per-metric trend: the number itself says whether that metric is
       rising or falling, so views and clicks are never conflated. */
    function trendPill(trend) {
        if (!trend) return "";
        var dir = trend.direction;
        var arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "—";
        var pct = Number(trend.changePercent) || 0;
        var text = dir === "flat" ? "stable" : (pct > 0 ? "+" : "") + pct + "%";
        var label = dir === "up" ? "Increasing" : dir === "down" ? "Decreasing" : "Stable";
        return '<span class="an-trend an-trend--' + (dir === "up" ? "up" : dir === "down" ? "down" : "flat") +
            ' an-trend--sm" aria-label="' + label + '">' + arrow + " " + escapeHtml(text) + "</span>";
    }

    function statCard(label, value, trend, detail) {
        return '<article class="an-card">' +
            '<div class="an-card__label">' + escapeHtml(label) + '</div>' +
            '<div class="an-card__value">' + escapeHtml(value) + '</div>' +
            '<div class="an-card__trend">' + trendBadge(trend) + '</div>' +
            '<div class="an-card__note">' + escapeHtml(detail || "") + '</div>' +
            '</article>';
    }

    /* One calculator card, used by the section pages and by shared links. The
       headline badge follows views; each metric keeps its own trend. */
    function calculatorCard(c) {
        return '<article class="an-calc">' +
            '<div class="an-calc__head">' +
                '<h3 class="an-calc__name">' + escapeHtml(c.name) + '</h3>' +
                trendBadge(c.viewsTrend || c.trend) +
            '</div>' +
            '<div class="an-calc__metrics">' +
                metric("Total Views", number(c.views), c.viewsTrend) +
                metric("Advertisement Clicks", number(c.adClicks), c.adClicksTrend) +
            '</div>' +
            '<div class="an-calc__note">' + escapeHtml(trendDetail(c.viewsTrend || c.trend)) + '</div>' +
            '</article>';
    }

    function metric(label, value, trend) {
        return '<div class="an-metric">' +
            '<span class="an-metric__label">' + escapeHtml(label) + '</span>' +
            '<span class="an-metric__value">' + escapeHtml(value) + '</span>' +
            (trend ? '<span class="an-metric__trend">' + trendPill(trend) + '</span>' : "") +
            '</div>';
    }

    function presetLabel(preset) {
        return { "7d": "last 7 days", "30d": "last 30 days", "last-month": "last month", "all": "all time" }[preset] || "";
    }

    function whenReady(fn) {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
        else fn();
    }

    function bindUnlock(form, input, onKey) {
        if (!form) return;
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            onKey(input.value.trim());
        });
    }

    function showUnlock(form, input) {
        if (!form) return;
        form.hidden = false;
        if (input) { input.value = ""; input.focus(); }
    }

    function apiHint() {
        return " Check that the analytics API is running and <code>MW_API_BASE</code> in <code>frontend/assets/js/api-config.js</code> points to it.";
    }

    function loadReport(options) {
        var els = options.els;
        els.error.hidden = true;
        els.status.textContent = options.loading || "Loading analytics…";

        fetchReport(options.endpoint, options.state, options.state.key).then(function (result) {
            if (result.status === 401) {
                els.status.textContent = "";
                showUnlock(els.unlock, els.key);
                return;
            }
            if (result.status !== 200 || !result.payload || result.payload.ok !== true) {
                var message = result.payload && result.payload.error && result.payload.error.message
                    ? result.payload.error.message
                    : "The analytics API answered " + result.status + ".";
                els.status.textContent = "";
                els.error.hidden = false;
                els.error.innerHTML = "<strong>" + escapeHtml(options.errorTitle || "Could not load report") + "</strong> " + escapeHtml(message) + apiHint();
                if (options.onError) options.onError();
                return;
            }
            if (els.unlock) els.unlock.hidden = true;
            options.onSuccess(result.payload);
        }).catch(function () {
            els.status.textContent = "";
            els.error.hidden = false;
            els.error.innerHTML = "<strong>Analytics API not reachable</strong> No response from <code>" +
                escapeHtml(apiBase() || window.location.origin) + escapeHtml(options.endpoint) + "</code>." + apiHint();
            if (options.onError) options.onError();
        });
    }

    function formatDateLabel(iso) {
        if (!isIsoDate(iso)) return iso;
        var d = new Date(iso + "T00:00:00Z");
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    }

    window.MWAnalytics = {
        isoToday: isoToday,
        isoDaysAgo: isoDaysAgo,
        isoLastMonthRange: isoLastMonthRange,
        presetRange: presetRange,
        isIsoDate: isIsoDate,
        apiBase: apiBase,
        readKey: readKey,
        saveKey: saveKey,
        fetchJson: fetchJson,
        fetchReport: fetchReport,
        postJson: postJson,
        loadReport: loadReport,
        bindUnlock: bindUnlock,
        whenReady: whenReady,
        escapeHtml: escapeHtml,
        number: number,
        compact: compact,
        trendBadge: trendBadge,
        trendPill: trendPill,
        trendDetail: trendDetail,
        statCard: statCard,
        calculatorCard: calculatorCard,
        metric: metric,
        presetLabel: presetLabel,
        formatDateLabel: formatDateLabel
    };
}(window));
