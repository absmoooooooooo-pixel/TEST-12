(function () {
    "use strict";

    var A = window.MWAnalytics;
    var rowId = document.body.getAttribute("data-analytics-row");
    if (!rowId) return;

    var state = { from: A.isoDaysAgo(29), to: A.isoToday(), preset: "30d", key: A.readKey() };

    var els = {
        status: document.getElementById("anStatus"),
        error: document.getElementById("anError"),
        unlock: document.getElementById("anUnlock"),
        key: document.getElementById("anKey"),
        summary: document.getElementById("anSummary"),
        chart: document.getElementById("anChart"),
        calculators: document.getElementById("anCalculators"),
        range: document.getElementById("anRange"),
        shareBtn: document.getElementById("anShareBtn"),
        shareModal: document.getElementById("shareModal"),
        shareClose: document.getElementById("shareClose"),
        shareCreate: document.getElementById("shareCreate"),
        shareExpiry: document.getElementById("shareExpiry"),
        shareResult: document.getElementById("shareResult"),
        shareUrl: document.getElementById("shareUrl"),
        shareCopy: document.getElementById("shareCopy"),
        shareRevoke: document.getElementById("shareRevoke"),
        shareMsg: document.getElementById("shareMsg")
    };

    var shareToken = "";

    function load() {
        A.loadReport({
            endpoint: "/api/analytics/rows/" + encodeURIComponent(rowId),
            state: state,
            els: els,
            loading: "Loading analytics…",
            errorTitle: "Could not load analytics",
            onSuccess: render,
            onError: function () {
                els.summary.innerHTML = "";
                els.chart.innerHTML = "";
                els.calculators.innerHTML = '<p class="an-empty">No data available.</p>';
            }
        });
    }

    function render(data) {
        var s = data.summary || {};
        var sectionTitle = (data.section && data.section.title) || "Section";

        els.summary.innerHTML =
            A.statCard("Total Views", A.number(s.views), s.viewsTrend, A.trendDetail(s.viewsTrend)) +
            A.statCard("Advertisement Clicks", A.number(s.adClicks), s.adClicksTrend, A.trendDetail(s.adClicksTrend));

        A.Chart.render(els.chart, data.daily || [], {
            ariaLabel: sectionTitle + " views and advertisement clicks over time"
        });

        var list = data.calculators || [];
        els.calculators.innerHTML = list.length
            ? list.map(A.calculatorCard).join("")
            : '<p class="an-empty">No calculators found for this section.</p>';

        els.status.textContent = sectionTitle + " · Showing " + data.from + " to " + data.to +
            " · Updated " + new Date(data.generatedAt).toLocaleString();
    }

    /* -------------------- Date range -------------------- */
    function setPreset(preset) {
        state.preset = preset;
        var range = A.presetRange(preset);
        if (!range) return;
        state.from = range.from;
        state.to = range.to;
        updateRangeButtons();
        load();
    }

    function updateRangeButtons() {
        if (!els.range) return;
        Array.prototype.forEach.call(els.range.querySelectorAll("[data-preset]"), function (btn) {
            var active = btn.getAttribute("data-preset") === state.preset;
            btn.setAttribute("aria-pressed", active ? "true" : "false");
        });
    }

    /* -------------------- Share modal -------------------- */
    function openShare() {
        if (!els.shareModal) return;
        els.shareModal.hidden = false;
        els.shareResult.hidden = true;
        els.shareMsg.textContent = "";
        els.shareUrl.value = "";
        shareToken = "";
        els.shareModal.querySelector(".an-modal__dialog").focus();
    }
    function closeShare() {
        if (els.shareModal) els.shareModal.hidden = true;
    }

    function createShare() {
        var ttlMs = Number(els.shareExpiry.value);
        els.shareMsg.textContent = "Creating link…";
        els.shareCreate.disabled = true;
        A.postJson("/api/analytics/shares", { rowId: rowId, ttlMs: ttlMs }, state.key).then(function (result) {
            els.shareCreate.disabled = false;
            if (result.status === 401) {
                els.shareMsg.textContent = "Unlock analytics first, then create a share link.";
                if (els.unlock) { els.unlock.hidden = false; if (els.key) els.key.focus(); }
                return;
            }
            if (result.status !== 201 || !result.payload || !result.payload.ok) {
                var msg = result.payload && result.payload.error && result.payload.error.message;
                els.shareMsg.textContent = msg || "Could not create share link.";
                return;
            }
            var token = result.payload.share.token;
            shareToken = token;
            // Share page lives at ../share/index.html relative to section page
            var shareUrl = new URL("../share/index.html", window.location.href);
            shareUrl.searchParams.set("token", token);
            els.shareUrl.value = shareUrl.toString();
            els.shareResult.hidden = false;
            els.shareMsg.textContent = "Link created. It expires at " + new Date(result.payload.share.expiresAt).toLocaleString() + ".";
        }).catch(function () {
            els.shareCreate.disabled = false;
            els.shareMsg.textContent = "Analytics API not reachable.";
        });
    }

    /* The owner can take a link back before it expires. The server is the
       authority: the DELETE below is checked against the analytics key. */
    function revokeShare() {
        if (!shareToken) return;
        els.shareRevoke.disabled = true;
        els.shareMsg.textContent = "Revoking link…";
        A.fetchJson(A.apiBase() + "/api/analytics/shares/" + encodeURIComponent(shareToken), {
            method: "DELETE",
            headers: state.key ? { "x-api-key": state.key } : {}
        }).then(function (result) {
            els.shareRevoke.disabled = false;
            if (result.status !== 200) {
                var msg = result.payload && result.payload.error && result.payload.error.message;
                els.shareMsg.textContent = msg || "Could not revoke the link.";
                return;
            }
            shareToken = "";
            els.shareResult.hidden = true;
            els.shareUrl.value = "";
            els.shareMsg.textContent = "Link revoked. It no longer opens the analytics page.";
        }).catch(function () {
            els.shareRevoke.disabled = false;
            els.shareMsg.textContent = "Analytics API not reachable.";
        });
    }

    function copyShare() {
        var url = els.shareUrl.value;
        if (!url) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
                els.shareMsg.textContent = "Link copied.";
            }, function () { fallbackCopy(url); });
        } else {
            fallbackCopy(url);
        }
    }
    function fallbackCopy(url) {
        els.shareUrl.focus();
        els.shareUrl.select();
        try { document.execCommand("copy"); els.shareMsg.textContent = "Link copied."; }
        catch (e) { els.shareMsg.textContent = "Copy failed. Please copy the link manually."; }
    }

    function start() {
        updateRangeButtons();
        if (els.range) {
            els.range.addEventListener("click", function (e) {
                var btn = e.target.closest ? e.target.closest("[data-preset]") : null;
                if (btn) setPreset(btn.getAttribute("data-preset"));
            });
        }
        if (els.shareBtn) els.shareBtn.addEventListener("click", openShare);
        if (els.shareClose) els.shareClose.addEventListener("click", closeShare);
        if (els.shareModal) {
            els.shareModal.addEventListener("click", function (e) { if (e.target === els.shareModal) closeShare(); });
            document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !els.shareModal.hidden) closeShare(); });
        }
        if (els.shareCreate) els.shareCreate.addEventListener("click", createShare);
        if (els.shareCopy) els.shareCopy.addEventListener("click", copyShare);
        if (els.shareRevoke) els.shareRevoke.addEventListener("click", revokeShare);

        A.bindUnlock(els.unlock, els.key, function (key) {
            state.key = key;
            A.saveKey(key);
            els.unlock.hidden = true;
            load();
        });

        load();
    }

    A.whenReady(start);
})();