(function () {
    "use strict";

    var A = window.MWAnalytics;
    var params = new URLSearchParams(window.location.search);
    var token = (params.get("token") || "").trim();

    var els = {
        status: document.getElementById("shStatus"),
        error: document.getElementById("shError"),
        expired: document.getElementById("shExpired"),
        content: document.getElementById("shContent"),
        title: document.getElementById("shTitle"),
        subtitle: document.getElementById("shSubtitle"),
        summary: document.getElementById("shSummary"),
        chart: document.getElementById("shChart"),
        calculators: document.getElementById("shCalculators"),
        range: document.getElementById("shRange"),
        meta: document.getElementById("shMeta")
    };

    var state = { from: A.isoDaysAgo(29), to: A.isoToday(), preset: "30d" };

    /* The server decides whether a token is expired, revoked or unknown; the
       page only chooses the sentence. No analytics markup is shown either way. */
    function showExpired(reason) {
        els.content.hidden = true;
        els.error.hidden = true;
        els.expired.hidden = false;
        els.subtitle.textContent = "Link unavailable";

        var copy = {
            revoked: "This analytics link was revoked by its owner. Please request a new share link.",
            invalid: "This analytics link is not valid. Please request a new share link from the owner."
        }[reason] || "This analytics link is no longer available. Please request a new share link from the owner.";

        var p = els.expired.querySelector("p");
        if (p) p.textContent = copy;
    }

    function load() {
        if (!token) { showExpired("invalid"); return; }
        els.status.textContent = "Loading shared analytics…";
        els.error.hidden = true;
        var search = new URLSearchParams({ from: state.from, to: state.to });
        A.fetchJson(A.apiBase() + "/api/analytics/shares/" + encodeURIComponent(token) + "?" + search.toString(), {})
            .then(function (result) {
                if (result.status === 410) {
                    var code = result.payload && result.payload.error && result.payload.error.code;
                    showExpired(code === "revoked" ? "revoked" : "expired");
                    els.status.textContent = "";
                    return;
                }
                if (result.status !== 200 || !result.payload || !result.payload.ok) {
                    if (result.status === 404) { showExpired("invalid"); els.status.textContent = ""; return; }
                    els.error.hidden = false;
                    els.error.innerHTML = "<strong>Could not load shared analytics.</strong> " + A.escapeHtml((result.payload && result.payload.error && result.payload.error.message) || "Please try again later.");
                    els.status.textContent = "";
                    return;
                }
                render(result.payload);
            }).catch(function () {
                els.status.textContent = "";
                els.error.hidden = false;
                els.error.innerHTML = "<strong>Analytics API not reachable.</strong> Please try again later.";
            });
    }

    function render(data) {
        els.expired.hidden = true;
        els.content.hidden = false;
        var section = data.section || {};
        var title = section.title || "Section";
        els.title.textContent = title + " Analytics";
        els.subtitle.textContent = "Read-only shared view";
        if (data.share && data.share.expiresAt) {
            els.meta.textContent = "Read-only link · Expires " + new Date(data.share.expiresAt).toLocaleString();
        }
        els.summary.innerHTML = A.statCard("Total Views", A.number(data.summary && data.summary.views), data.summary && data.summary.viewsTrend,
                A.trendDetail(data.summary && data.summary.viewsTrend)) +
            A.statCard("Advertisement Clicks", A.number(data.summary && data.summary.adClicks), data.summary && data.summary.adClicksTrend,
                A.trendDetail(data.summary && data.summary.adClicksTrend));

        A.Chart.render(els.chart, data.daily || [], {
            ariaLabel: title + " views and advertisement clicks over time"
        });

        var list = data.calculators || [];
        els.calculators.innerHTML = list.length
            ? list.map(A.calculatorCard).join("")
            : '<p class="an-empty">No calculators found.</p>';

        els.status.textContent = "Showing " + data.from + " to " + data.to;
    }

    function setPreset(preset) {
        var range = A.presetRange(preset);
        if (!range) return;
        state.preset = preset; state.from = range.from; state.to = range.to;
        Array.prototype.forEach.call(els.range.querySelectorAll("[data-preset]"), function (btn) {
            btn.setAttribute("aria-pressed", btn.getAttribute("data-preset") === preset ? "true" : "false");
        });
        load();
    }

    A.whenReady(function () {
        if (els.range) {
            els.range.addEventListener("click", function (e) {
                var btn = e.target.closest ? e.target.closest("[data-preset]") : null;
                if (btn) setPreset(btn.getAttribute("data-preset"));
            });
        }
        load();
    });
})();