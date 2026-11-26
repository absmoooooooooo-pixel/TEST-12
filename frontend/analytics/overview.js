/* Main Analytics Dashboard — every calculator, one data source.
 *
 * The overview payload is the single aggregate: its summary, its calculator
 * rows and its daily series all come from the same events. When a section is
 * selected the page asks the API for that section's report over the identical
 * date range (so the numbers reconcile exactly) and draws the graph from that
 * section's own daily series instead of pretending the whole-site line is a
 * section line.
 */
(function () {
    "use strict";

    var A = window.MWAnalytics;
    var state = { from: A.isoDaysAgo(29), to: A.isoToday(), preset: "30d", key: A.readKey(), section: "", q: "" };
    var lastData = null;
    var sectionSeq = 0;

    var els = {
        status: document.getElementById("ovStatus"),
        error: document.getElementById("ovError"),
        unlock: document.getElementById("ovUnlock"),
        key: document.getElementById("ovKey"),
        summary: document.getElementById("ovSummary"),
        scope: document.getElementById("ovScope"),
        headingNote: document.getElementById("ovHeadingNote"),
        chart: document.getElementById("ovChart"),
        chartTitle: document.getElementById("ovChartSub"),
        tableBody: document.getElementById("ovTableBody"),
        tableEmpty: document.getElementById("ovTableEmpty"),
        range: document.getElementById("ovRange"),
        sectionFilter: document.getElementById("ovSection"),
        search: document.getElementById("ovSearch")
    };

    function load() {
        A.loadReport({
            endpoint: "/api/analytics/overview",
            state: state,
            els: els,
            loading: "Loading dashboard…",
            errorTitle: "Could not load dashboard",
            onSuccess: render,
            onError: function () {
                lastData = null;
                els.summary.innerHTML = "";
                els.chart.innerHTML = "";
                els.scope.textContent = "";
                els.tableBody.innerHTML = "";
                els.tableEmpty.hidden = false;
            }
        });
    }

    function render(data) {
        lastData = data;
        renderSectionOptions(data.sections || []);
        renderTable();
        els.status.textContent = "Showing " + data.from + " to " + data.to +
            " · Updated " + new Date(data.generatedAt).toLocaleString();
        applySectionView();
    }

    function summaryCards(summary, viewsLabel, clicksLabel) {
        return A.statCard(viewsLabel, A.number(summary.views), summary.viewsTrend, A.trendDetail(summary.viewsTrend)) +
            A.statCard(clicksLabel, A.number(summary.adClicks), summary.adClicksTrend, A.trendDetail(summary.adClicksTrend));
    }

    function renderAllView() {
        if (!lastData) return;
        els.summary.innerHTML = summaryCards(lastData.summary || {}, "Total Website Calculator Views", "Total Advertisement Clicks");
        A.Chart.render(els.chart, lastData.daily || [], {
            ariaLabel: "Total website calculator views and advertisement clicks over time",
            viewsLabel: "Total Views"
        });
        if (els.scope) {
            var sections = (lastData.sections || []).length;
            var calculators = (lastData.calculators || []).length;
            els.scope.textContent = "All sections · " + sections + " sections · " + calculators + " calculators";
        }
        if (els.headingNote) els.headingNote.textContent = "All sections combined";
        if (els.chartTitle) els.chartTitle.textContent = "Total views and advertisement clicks over time";
    }

    function loadSectionView(sectionId) {
        var seq = ++sectionSeq;
        els.status.textContent = "Filtering to " + sectionLabel(sectionId) + "…";

        A.fetchReport("/api/analytics/rows/" + encodeURIComponent(sectionId), state, state.key).then(function (result) {
            if (seq !== sectionSeq) return; // a newer filter or range won
            if (result.status !== 200 || !result.payload || result.payload.ok !== true) {
                els.status.textContent = "";
                els.error.hidden = false;
                els.error.innerHTML = "<strong>Could not load this section</strong> " +
                    A.escapeHtml((result.payload && result.payload.error && result.payload.error.message) || "The analytics API did not return the section report.");
                return;
            }
            var data = result.payload;
            var title = (data.section && data.section.title) || sectionLabel(sectionId);
            els.error.hidden = true;
            els.summary.innerHTML = summaryCards(data.summary || {}, "Total Views · " + title, "Advertisement Clicks · " + title);
            A.Chart.render(els.chart, data.daily || [], {
                ariaLabel: title + " views and advertisement clicks over time"
            });
            if (els.scope) els.scope.textContent = title + " only · " + (data.calculators || []).length + " calculators · table filtered below";
            if (els.headingNote) els.headingNote.textContent = title + " only";
            if (els.chartTitle) els.chartTitle.textContent = title + ": views and advertisement clicks over time";
            els.status.textContent = "Showing " + data.from + " to " + data.to + " · " + title + " only";
        }).catch(function () {
            if (seq !== sectionSeq) return;
            els.status.textContent = "";
            els.error.hidden = false;
            els.error.innerHTML = "<strong>Analytics API not reachable</strong> The section report could not be loaded.";
        });
    }

    function applySectionView() {
        if (!lastData) return;
        if (!state.section) {
            sectionSeq += 1;
            els.error.hidden = true;
            renderAllView();
            return;
        }
        loadSectionView(state.section);
    }

    function sectionLabel(id) {
        var sections = (lastData && lastData.sections) || [];
        for (var i = 0; i < sections.length; i += 1) {
            if (sections[i].id === id) return sections[i].title;
        }
        return id;
    }

    function renderSectionOptions(sections) {
        if (!els.sectionFilter) return;
        var current = state.section;
        var opts = ['<option value="">All Sections</option>'];
        sections.forEach(function (s) {
            opts.push('<option value="' + A.escapeHtml(s.id) + '">' + A.escapeHtml(s.title) + '</option>');
        });
        els.sectionFilter.innerHTML = opts.join("");
        if (current && sections.some(function (s) { return s.id === current; })) {
            els.sectionFilter.value = current;
        } else {
            state.section = "";
            els.sectionFilter.value = "";
        }
    }

    function filteredCalculators() {
        if (!lastData) return [];
        var list = (lastData.calculators || []).slice();
        if (state.section) list = list.filter(function (c) { return c.sectionId === state.section; });
        if (state.q) {
            var q = state.q.toLowerCase();
            list = list.filter(function (c) {
                return String(c.name || "").toLowerCase().indexOf(q) !== -1 ||
                       String(c.sectionTitle || "").toLowerCase().indexOf(q) !== -1;
            });
        }
        return list;
    }

    function renderTable() {
        var list = filteredCalculators();
        els.tableEmpty.hidden = list.length > 0;
        if (!list.length) { els.tableBody.innerHTML = ""; return; }
        els.tableBody.innerHTML = list.map(function (c) {
            return '<tr>' +
                '<td class="is-section">' + A.escapeHtml(c.sectionTitle || "") + '</td>' +
                '<td class="is-name">' + A.escapeHtml(c.name || "") + '</td>' +
                '<td class="is-number is-num-views" data-label="Views">' + A.number(c.views) + '</td>' +
                '<td class="is-number is-num-clicks" data-label="Clicks">' + A.number(c.adClicks) + '</td>' +
                '<td class="is-trend">' + A.trendBadge(c.viewsTrend || c.trend) + '</td>' +
            '</tr>';
        }).join("");
    }

    function setPreset(preset) {
        var range = A.presetRange(preset);
        if (!range) return;
        state.preset = preset;
        state.from = range.from;
        state.to = range.to;
        updateRangeButtons();
        load();
    }

    function updateRangeButtons() {
        if (!els.range) return;
        Array.prototype.forEach.call(els.range.querySelectorAll("[data-preset]"), function (btn) {
            btn.setAttribute("aria-pressed", btn.getAttribute("data-preset") === state.preset ? "true" : "false");
        });
    }

    function start() {
        updateRangeButtons();
        if (els.range) {
            els.range.addEventListener("click", function (e) {
                var btn = e.target.closest ? e.target.closest("[data-preset]") : null;
                if (btn) setPreset(btn.getAttribute("data-preset"));
            });
        }
        if (els.sectionFilter) {
            els.sectionFilter.addEventListener("change", function () {
                state.section = els.sectionFilter.value;
                renderTable();
                applySectionView();
            });
        }
        if (els.search) {
            var timer = null;
            els.search.addEventListener("input", function () {
                clearTimeout(timer);
                timer = setTimeout(function () { state.q = els.search.value.trim(); renderTable(); }, 120);
            });
        }
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
