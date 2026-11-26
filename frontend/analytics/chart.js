/* ==========================================================================
   ANALYTICS CHART — one renderer for every analytics page
   --------------------------------------------------------------------------
   The section pages, the main dashboard and the shared-link page all draw the
   same two series (calculator views and advertisement clicks) from the same
   payload. Keeping the drawing here means one tooltip, one axis treatment and
   one place to fix a bug.

   Data is never invented: every point comes from the API's daily series. The
   renderer only groups consecutive days into buckets when a range is long, and
   a bucket is the exact sum of the days it contains.
   ========================================================================== */

(function (window) {
    "use strict";

    var A = window.MWAnalytics || (window.MWAnalytics = {});

    /* The viewBox width follows the container, so the line fills its card
       exactly at every screen size instead of being letterboxed by
       preserveAspectRatio. Height stays fixed so labels keep their size. */
    var MIN_WIDTH = 300;
    var MAX_WIDTH = 1600;
    var HEIGHT = 300;
    var PAD = { l: 46, r: 18, t: 16, b: 34 };
    var VIEWS = "#0f8c84";
    var CLICKS = "#d97706";
    var MAX_POINTS = 160;

    /* Whole, round tick steps with the data using most of the height: the axis
       reads 0 / 10 / 20 / 30 / 40 / 50 rather than 0 / 13 / 25 / 38 / 50, and
       a series that peaks at 45 does not sit in the bottom half of the card. */
    var TICKS = 5;

    function niceScale(value) {
        if (value <= TICKS) return { max: TICKS, step: 1 };
        var raw = value / TICKS;
        var magnitude = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
        var steps = [1, 2, 5, 10];
        var step = 10 * magnitude;
        for (var i = 0; i < steps.length; i += 1) {
            if (steps[i] * magnitude >= raw) { step = steps[i] * magnitude; break; }
        }
        return { max: step * TICKS, step: step };
    }

    /* Long ranges are summed into evenly sized buckets for display only; the
       totals and trends above the chart always come from the raw API numbers. */
    function bucketize(rows, maxPoints) {
        if (rows.length <= maxPoints) {
            return rows.map(function (row) {
                return { date: row.date, endDate: row.date, views: row.views || 0, adClicks: row.adClicks || 0 };
            });
        }

        var size = Math.ceil(rows.length / maxPoints);
        var out = [];
        for (var i = 0; i < rows.length; i += size) {
            var slice = rows.slice(i, i + size);
            var views = 0;
            var adClicks = 0;
            for (var j = 0; j < slice.length; j += 1) {
                views += slice[j].views || 0;
                adClicks += slice[j].adClicks || 0;
            }
            out.push({
                date: slice[0].date,
                endDate: slice[slice.length - 1].date,
                views: views,
                adClicks: adClicks,
                days: slice.length
            });
        }
        return out;
    }

    function render(container, daily, options) {
        if (!container) return;
        container.__anChart = { daily: daily, options: options || {} };
        container.classList.add("an-chart--interactive");
        draw(container);
        observe(container);
    }

    function draw(container) {
        var state = container.__anChart || {};
        var opts = state.options || {};
        var rows = (state.daily || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });

        if (!rows.length) {
            container.innerHTML = '<p class="an-empty">No activity in this period.</p>';
            return;
        }

        var style = window.getComputedStyle(container);
        var padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
        var box = container.clientWidth - padX;
        var W = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, box || 720)));
        var H = HEIGHT;
        var points = bucketize(rows, MAX_POINTS);
        var plotWidth = W - PAD.l - PAD.r;
        var plotHeight = H - PAD.t - PAD.b;
        var max = 0;
        points.forEach(function (p) { max = Math.max(max, p.views, p.adClicks); });
        var scale = niceScale(max);
        max = scale.max;

        var step = points.length > 1 ? plotWidth / (points.length - 1) : 0;
        var xAt = function (i) { return points.length > 1 ? PAD.l + step * i : PAD.l + plotWidth / 2; };
        var yAt = function (v) { return PAD.t + plotHeight - (v / max) * plotHeight; };

        var parts = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" preserveAspectRatio="xMidYMid meet" aria-label="' +
            A.escapeHtml(opts.ariaLabel || "Views and advertisement clicks over time") + '">'];

        parts.push('<defs><linearGradient id="anFillViews" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="' + VIEWS + '" stop-opacity="0.16"/>' +
            '<stop offset="100%" stop-color="' + VIEWS + '" stop-opacity="0"/></linearGradient></defs>');

        for (var g = 0; g <= TICKS; g += 1) {
            var y = PAD.t + (plotHeight / TICKS) * g;
            var value = max - scale.step * g;
            parts.push('<line x1="' + PAD.l + '" y1="' + y.toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + y.toFixed(1) +
                '" stroke="#e3ecea" stroke-dasharray="' + (g === TICKS ? "0" : "3 4") + '"/>');
            parts.push('<text x="' + (PAD.l - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="#6b8581">' +
                A.compact(value) + '</text>');
        }

        var maxLabels = W < 460 ? 4 : W < 720 ? 5 : 7;
        var labelEvery = Math.max(1, Math.ceil(points.length / maxLabels));
        points.forEach(function (point, i) {
            if (i % labelEvery !== 0 && i !== points.length - 1) return;
            parts.push('<text x="' + xAt(i).toFixed(1) + '" y="' + (H - 10) +
                '" text-anchor="middle" font-size="11" fill="#6b8581">' + A.escapeHtml(A.formatDateLabel(point.date)) + '</text>');
        });

        /* Area under the views line, then both lines. */
        var viewsPath = points.map(function (p, i) { return (i ? "L" : "M") + xAt(i).toFixed(1) + " " + yAt(p.views).toFixed(1); }).join(" ");
        parts.push('<path d="' + viewsPath + ' L' + xAt(points.length - 1).toFixed(1) + ' ' + (PAD.t + plotHeight).toFixed(1) +
            ' L' + xAt(0).toFixed(1) + ' ' + (PAD.t + plotHeight).toFixed(1) + ' Z" fill="url(#anFillViews)" stroke="none"/>');

        parts.push(seriesPath(points, "views", VIEWS, xAt, yAt));
        parts.push(seriesPath(points, "adClicks", CLICKS, xAt, yAt));

        /* Markers are only drawn when they are far enough apart to be useful. */
        if (points.length <= 62) {
            points.forEach(function (p, i) {
                parts.push('<circle cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(p.views).toFixed(1) +
                    '" r="3.2" fill="#fff" stroke="' + VIEWS + '" stroke-width="2"/>');
                parts.push('<circle cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(p.adClicks).toFixed(1) +
                    '" r="3.2" fill="#fff" stroke="' + CLICKS + '" stroke-width="2"/>');
            });
        }

        /* Hover guide: a vertical line, two emphasis dots and an HTML tooltip. */
        parts.push('<g class="an-hover" opacity="0" pointer-events="none">' +
            '<line class="an-hover__line" y1="' + PAD.t + '" y2="' + (PAD.t + plotHeight) + '" stroke="#9db8b4" stroke-dasharray="3 3"/>' +
            '<circle class="an-hover__views" r="5" fill="#fff" stroke="' + VIEWS + '" stroke-width="2.5"/>' +
            '<circle class="an-hover__clicks" r="5" fill="#fff" stroke="' + CLICKS + '" stroke-width="2.5"/>' +
            '</g>');
        parts.push('<rect class="an-hit" x="' + PAD.l + '" y="' + PAD.t + '" width="' + plotWidth + '" height="' + plotHeight +
            '" fill="transparent"/>');
        parts.push('</svg>');

        parts.push('<div class="an-tooltip" hidden></div>');
        parts.push('<div class="an-legend">' +
            '<span><i style="background:' + VIEWS + '"></i>' + A.escapeHtml(opts.viewsLabel || "Views") + '</span>' +
            '<span><i style="background:' + CLICKS + '"></i>' + A.escapeHtml(opts.clicksLabel || "Advertisement Clicks") + '</span>' +
            '</div>');

        container.innerHTML = parts.join("");
        wire(container, points, xAt, yAt, W);
    }

    var observed = typeof window.ResizeObserver === "function";

    function observe(container) {
        if (!observed || container.__anObserver) return;
        var timer = null;
        var observer = new window.ResizeObserver(function () {
            clearTimeout(timer);
            timer = setTimeout(function () { draw(container); }, 120);
        });
        observer.observe(container);
        container.__anObserver = observer;
    }

    function seriesPath(points, key, color, xAt, yAt) {
        var d = points.map(function (p, i) { return (i ? "L" : "M") + xAt(i).toFixed(1) + " " + yAt(p[key]).toFixed(1); }).join(" ");
        return '<path d="' + d + '" fill="none" stroke="' + color +
            '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    }

    function wire(container, points, xAt, yAt, W) {
        var svg = container.querySelector("svg");
        var hit = container.querySelector(".an-hit");
        var hover = container.querySelector(".an-hover");
        var tooltip = container.querySelector(".an-tooltip");
        if (!svg || !hit || !hover || !tooltip) return;

        var line = hover.querySelector(".an-hover__line");
        var viewsDot = hover.querySelector(".an-hover__views");
        var clicksDot = hover.querySelector(".an-hover__clicks");

        function indexFromEvent(event) {
            var rect = svg.getBoundingClientRect();
            if (!rect.width) return -1;
            var x = ((event.clientX - rect.left) / rect.width) * W;
            if (points.length === 1) return 0;
            var index = Math.round((x - PAD.l) / ((W - PAD.l - PAD.r) / (points.length - 1)));
            return Math.max(0, Math.min(points.length - 1, index));
        }

        function show(event) {
            var index = indexFromEvent(event);
            if (index < 0) return;
            var point = points[index];
            var x = xAt(index);

            hover.setAttribute("opacity", "1");
            line.setAttribute("x1", x.toFixed(1));
            line.setAttribute("x2", x.toFixed(1));
            viewsDot.setAttribute("cx", x.toFixed(1));
            viewsDot.setAttribute("cy", yAt(point.views).toFixed(1));
            clicksDot.setAttribute("cx", x.toFixed(1));
            clicksDot.setAttribute("cy", yAt(point.adClicks).toFixed(1));

            var label = point.date === point.endDate
                ? A.formatDateLabel(point.date)
                : A.formatDateLabel(point.date) + " – " + A.formatDateLabel(point.endDate);

            tooltip.hidden = false;
            tooltip.innerHTML =
                '<div class="an-tooltip__date">' + A.escapeHtml(label) + '</div>' +
                '<div class="an-tooltip__row"><i style="background:' + VIEWS + '"></i>Views<strong>' + A.number(point.views) + '</strong></div>' +
                '<div class="an-tooltip__row"><i style="background:' + CLICKS + '"></i>Clicks<strong>' + A.number(point.adClicks) + '</strong></div>';

            var rect = svg.getBoundingClientRect();
            var px = (x / W) * rect.width;
            var left = Math.max(8, Math.min(rect.width - 140, px - 70));
            tooltip.style.left = left + "px";
        }

        function hide() {
            hover.setAttribute("opacity", "0");
            tooltip.hidden = true;
        }

        hit.addEventListener("pointermove", show, { passive: true });
        hit.addEventListener("pointerdown", show, { passive: true });
        hit.addEventListener("pointerleave", hide);
        svg.addEventListener("pointerleave", hide);
        window.addEventListener("scroll", hide, { passive: true });
    }

    A.Chart = { render: render };
}(window));
