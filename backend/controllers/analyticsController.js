/*
 * Analytics controller.
 *
 * Source of truth: tracked events in analytics/store.js. Nothing is estimated.
 * The frontend dashboards display calculator views, advertisement clicks and
 * performance trends derived from those events.
 */
"use strict";

const store = require("../analytics/store");
const shares = require("../analytics/shares");

const MAX_RANGE_DAYS = 3660; // allow "all time" while keeping queries bounded
const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(timestamp) {
    return new Date(timestamp).toISOString().slice(0, 10);
}

function shiftDays(key, days) {
    const time = Date.parse(key + "T00:00:00Z");
    return dayKey(time + days * DAY_MS);
}

function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T00:00:00Z"));
}

/* a-row -> "A Section": the dashboards speak about sections, the row ids stay
   stable because the advertisement system and tracking already use them. */
function sectionLabel(rowId, fallback) {
    const match = /^([a-z0-9]+)-row$/i.exec(String(rowId || ""));
    if (match) return match[1].toUpperCase() + " Section";
    return fallback || String(rowId || "");
}

/* One bucket per calendar day in the range, so a day without events is a real
   zero on the graph instead of a missing point that squeezes the x axis.
   Leading empty days are dropped ("all time" starts at the first event);
   trailing days up to `to` are kept so the line reaches today. */
function dailySeries(from, to, buckets) {
    const out = [];
    const end = Date.parse(to + "T00:00:00Z");
    let time = Date.parse(from + "T00:00:00Z");
    let started = false;

    while (time <= end) {
        const date = dayKey(time);
        const bucket = buckets.get(date);
        const views = bucket ? bucket.views : 0;
        const adClicks = bucket ? bucket.adClicks : 0;
        if (views || adClicks) started = true;
        if (started) out.push({ date, views, adClicks });
        time += DAY_MS;
    }

    return out;
}

function parseRange(searchParams) {
    const today = dayKey(Date.now());
    const defaultFrom = shiftDays(today, -29);

    let from = searchParams.get("from") || defaultFrom;
    let to = searchParams.get("to") || today;

    if (!validDate(from)) from = defaultFrom;
    if (!validDate(to)) to = today;
    if (from > to) {
        const swap = from;
        from = to;
        to = swap;
    }

    const earliest = shiftDays(to, -(MAX_RANGE_DAYS - 1));
    if (from < earliest) from = earliest;
    return { from, to };
}

function previousRange(from, to) {
    const fromMs = Date.parse(from + "T00:00:00Z");
    const toMs = Date.parse(to + "T00:00:00Z");
    const days = Math.round((toMs - fromMs) / DAY_MS) + 1;
    const prevTo = shiftDays(from, -1);
    const prevFrom = shiftDays(prevTo, -(days - 1));
    return { from: prevFrom, to: prevTo, days };
}

function trendDirection(current, previous) {
    if (current > previous) return "up";
    if (current < previous) return "down";
    return "flat";
}

function pctChange(current, previous) {
    if (previous === 0) return current === 0 ? 0 : 100;
    return Math.round(((current - previous) / previous) * 1000) / 10;
}

function buildCalculatorRows(row, events) {
    return row.calculators.map((calculator) => ({
        id: calculator.id,
        name: calculator.name,
        views: 0,
        adClicks: 0
    }));
}

function tallyEvents(calculators, events) {
    const byId = new Map(calculators.map((c) => [c.id, c]));
    const daily = new Map();
    const summary = { views: 0, adClicks: 0 };

    for (const event of events) {
        const calc = byId.get(event.calculator);
        let day = daily.get(event.date);
        if (!day) {
            day = { date: event.date, views: 0, adClicks: 0 };
            daily.set(event.date, day);
        }

        if (event.type === "calculator_view") {
            summary.views += 1;
            day.views += 1;
            if (calc) calc.views += 1;
        } else if (event.type === "ad_click") {
            summary.adClicks += 1;
            day.adClicks += 1;
            if (calc) calc.adClicks += 1;
        }
        // calculator_click and ad_impression are tracked but not primary UI metrics.
    }

    return { summary, daily };
}

function addTrends(calculators, prevEvents) {
    const prev = new Map();
    for (const calc of calculators) prev.set(calc.id, { views: 0, adClicks: 0 });

    for (const event of prevEvents) {
        const p = prev.get(event.calculator);
        if (!p) continue;
        if (event.type === "calculator_view") p.views += 1;
        if (event.type === "ad_click") p.adClicks += 1;
    }

    for (const calc of calculators) {
        const p = prev.get(calc.id) || { views: 0, adClicks: 0 };
        calc.viewsTrend = {
            direction: trendDirection(calc.views, p.views),
            changePercent: pctChange(calc.views, p.views),
            previous: p.views,
            current: calc.views
        };
        calc.adClicksTrend = {
            direction: trendDirection(calc.adClicks, p.adClicks),
            changePercent: pctChange(calc.adClicks, p.adClicks),
            previous: p.adClicks,
            current: calc.adClicks
        };
        // Combined performance trend: views primary, ad clicks secondary signal.
        const scoreNow = calc.views + calc.adClicks;
        const scorePrev = p.views + p.adClicks;
        calc.trend = {
            direction: trendDirection(scoreNow, scorePrev),
            changePercent: pctChange(scoreNow, scorePrev),
            previous: scorePrev,
            current: scoreNow
        };
    }
}

function report(rowId, searchParams) {
    const row = store.rowInfo(rowId);
    if (!row) {
        return { status: 404, body: { ok: false, error: { message: "Unknown section: " + rowId } } };
    }

    const { from, to } = parseRange(searchParams);
    const prev = previousRange(from, to);
    const events = store.query(row.id, { from, to });
    const prevEvents = store.query(row.id, { from: prev.from, to: prev.to });

    const calculators = buildCalculatorRows(row, events);
    const { summary, daily } = tallyEvents(calculators, events);
    addTrends(calculators, prevEvents);

    const prevSummary = { views: 0, adClicks: 0 };
    for (const e of prevEvents) {
        if (e.type === "calculator_view") prevSummary.views += 1;
        if (e.type === "ad_click") prevSummary.adClicks += 1;
    }

    return {
        status: 200,
        body: {
            ok: true,
            section: { id: row.id, title: sectionLabel(row.id, row.title), rowTitle: row.title },
            from,
            to,
            previous: { from: prev.from, to: prev.to },
            generatedAt: new Date().toISOString(),
            summary: {
                views: summary.views,
                adClicks: summary.adClicks,
                viewsTrend: {
                    direction: trendDirection(summary.views, prevSummary.views),
                    changePercent: pctChange(summary.views, prevSummary.views),
                    previous: prevSummary.views,
                    current: summary.views
                },
                adClicksTrend: {
                    direction: trendDirection(summary.adClicks, prevSummary.adClicks),
                    changePercent: pctChange(summary.adClicks, prevSummary.adClicks),
                    previous: prevSummary.adClicks,
                    current: summary.adClicks
                }
            },
            calculators,
            daily: dailySeries(from, to, daily)
        }
    };
}

function overview(searchParams) {
    const { from, to } = parseRange(searchParams);
    const prev = previousRange(from, to);
    const events = store.queryRange({ from, to });
    const prevEvents = store.queryRange({ from: prev.from, to: prev.to });
    const rows = store.rows();

    const rowMap = new Map();
    const calcMap = new Map();
    for (const row of rows) {
        rowMap.set(row.id, {
            id: row.id,
            title: sectionLabel(row.id, row.title),
            rowTitle: row.title,
            views: 0,
            adClicks: 0
        });
        for (const calc of row.calculators) {
            calcMap.set(calc.id, {
                id: calc.id,
                name: calc.name,
                sectionId: row.id,
                sectionTitle: sectionLabel(row.id, row.title),
                views: 0,
                adClicks: 0
            });
        }
    }

    const daily = new Map();
    const summary = { views: 0, adClicks: 0 };

    for (const event of events) {
        const calc = calcMap.get(event.calculator);
        const rowBucket = rowMap.get(event.row);
        let day = daily.get(event.date);
        if (!day) {
            day = { date: event.date, views: 0, adClicks: 0 };
            daily.set(event.date, day);
        }
        if (event.type === "calculator_view") {
            summary.views += 1;
            day.views += 1;
            if (calc) calc.views += 1;
            if (rowBucket) rowBucket.views += 1;
        } else if (event.type === "ad_click") {
            summary.adClicks += 1;
            day.adClicks += 1;
            if (calc) calc.adClicks += 1;
            if (rowBucket) rowBucket.adClicks += 1;
        }
    }

    const prevCalc = new Map();
    for (const [id] of calcMap) prevCalc.set(id, { views: 0, adClicks: 0 });
    const prevSummary = { views: 0, adClicks: 0 };
    for (const event of prevEvents) {
        if (event.type === "calculator_view") {
            prevSummary.views += 1;
            const p = prevCalc.get(event.calculator);
            if (p) p.views += 1;
        } else if (event.type === "ad_click") {
            prevSummary.adClicks += 1;
            const p = prevCalc.get(event.calculator);
            if (p) p.adClicks += 1;
        }
    }

    const calculators = Array.from(calcMap.values()).map((calc) => {
        const p = prevCalc.get(calc.id) || { views: 0, adClicks: 0 };
        const scoreNow = calc.views + calc.adClicks;
        const scorePrev = p.views + p.adClicks;
        return Object.assign({}, calc, {
            viewsTrend: {
                direction: trendDirection(calc.views, p.views),
                changePercent: pctChange(calc.views, p.views),
                previous: p.views,
                current: calc.views
            },
            adClicksTrend: {
                direction: trendDirection(calc.adClicks, p.adClicks),
                changePercent: pctChange(calc.adClicks, p.adClicks),
                previous: p.adClicks,
                current: calc.adClicks
            },
            trend: {
                direction: trendDirection(scoreNow, scorePrev),
                changePercent: pctChange(scoreNow, scorePrev),
                previous: scorePrev,
                current: scoreNow
            }
        });
    });

    return {
        status: 200,
        body: {
            ok: true,
            scope: "all-sections",
            from,
            to,
            previous: { from: prev.from, to: prev.to },
            generatedAt: new Date().toISOString(),
            summary: {
                views: summary.views,
                adClicks: summary.adClicks,
                viewsTrend: {
                    direction: trendDirection(summary.views, prevSummary.views),
                    changePercent: pctChange(summary.views, prevSummary.views),
                    previous: prevSummary.views,
                    current: summary.views
                },
                adClicksTrend: {
                    direction: trendDirection(summary.adClicks, prevSummary.adClicks),
                    changePercent: pctChange(summary.adClicks, prevSummary.adClicks),
                    previous: prevSummary.adClicks,
                    current: summary.adClicks
                }
            },
            sections: Array.from(rowMap.values()),
            calculators,
            daily: dailySeries(from, to, daily)
        }
    };
}

/* ------------------------- Share links ------------------------- */

function createShare(payload) {
    const rowId = String(payload && payload.rowId || "").trim();
    const ttlMs = Number(payload && payload.ttlMs);
    const row = store.rowInfo(rowId);
    if (!row) return { status: 404, body: { ok: false, error: { message: "Unknown section: " + rowId } } };

    const result = shares.create(rowId, ttlMs);
    if (!result.ok) {
        const msg = result.error === "invalid_ttl" ? "Invalid expiration duration." : "Invalid share request.";
        return { status: 400, body: { ok: false, error: { message: msg } } };
    }

    return {
        status: 201,
        body: {
            ok: true,
            share: result.share,
            section: { id: row.id, title: sectionLabel(row.id, row.title), rowTitle: row.title }
        }
    };
}

function shareReport(token, searchParams) {
    const resolved = shares.resolve(token);
    if (!resolved.ok) {
        const status = resolved.reason === "expired" || resolved.reason === "revoked" ? 410 : 404;
        return {
            status,
            body: {
                ok: false,
                error: {
                    code: resolved.reason,
                    message: resolved.reason === "expired"
                        ? "This share link has expired."
                        : resolved.reason === "revoked"
                            ? "This share link has been revoked."
                            : "Share link not found."
                }
            }
        };
    }

    const reportResult = report(resolved.record.rowId, searchParams);
    if (reportResult.status !== 200) return reportResult;
    return {
        status: 200,
        body: Object.assign({}, reportResult.body, {
            share: {
                rowId: resolved.record.rowId,
                expiresAt: resolved.record.expiresAt,
                createdAt: resolved.record.createdAt
            },
            shared: true
        })
    };
}

function revokeShare(token) {
    const result = shares.revoke(token);
    if (!result.ok) return { status: 404, body: { ok: false, error: { message: "Share link not found." } } };
    return { status: 200, body: { ok: true, share: result.record } };
}

/* ------------------------- Ingestion ------------------------- */

function collect(payload) {
    const result = store.record(payload);

    if (result.recorded) {
        return { status: 204, body: null };
    }

    if (result.reason === "storage") {
        return {
            status: 500,
            body: { ok: false, error: { message: "The analytics store could not write this event." } }
        };
    }

    return { status: 204, body: null };
}

module.exports = { collect, report, overview, createShare, shareReport, revokeShare };
