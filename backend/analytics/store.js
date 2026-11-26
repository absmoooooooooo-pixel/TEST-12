/*
 * Analytics event store.
 *
 * Events are appended to one NDJSON file per UTC day under
 * ANALYTICS_DATA_DIR (backend/analytics/data, git-ignored). On start the files
 * inside the retention window are read into memory once; the dashboard is then
 * answered from memory and new events are appended to disk synchronously.
 *
 * Why files instead of a database
 *   This API has no dependencies and can be deployed to any Node 18 host. The
 *   volume of this site's first-party events is small, and an append-only log
 *   survives a crash without corruption. To move to a database later, keep the
 *   record()/query() surface and replace the internals.
 *
 * Guarantees
 *   - At most one record per (type, locale, calculator, eventInstanceId).
 *   - Views and impressions are additionally limited to one per visitor and
 *     calculator/Row per ANALYTICS_DEDUPE_WINDOW_MS.
 *   - Timestamps are the server's clock (UTC), never a browser value.
 *   - No IP address is stored; the device id is stored only as a SHA-256 hash.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const config = require("../config");
const rowsData = require("./rows.json");

const EVENT_TYPES = new Set([
    "calculator_click",
    "calculator_view",
    "ad_impression",
    "ad_click"
]);

/* These two describe a state ("this calculator is being looked at"), so a
   reload must not add another one. Clicks are actions and are always counted. */
const WINDOW_TYPES = new Set(["calculator_view", "ad_impression"]);

const ROWS = new Map();
const ROW_OF_CALCULATOR = new Map();

for (const row of rowsData.rows) {
    ROWS.set(row.id, row);
    for (const calculator of row.calculators) {
        ROW_OF_CALCULATOR.set(calculator.id, row.id);
    }
}

let events = [];
let dedupeKeys = new Set();
let recentWindow = new Map();
let loaded = false;

/* ------------------------------------------------------------------ *
 * Loading and retention
 * ------------------------------------------------------------------ */

function dateKey(timestamp) {
    return new Date(timestamp).toISOString().slice(0, 10);
}

function isAdEvent(event) {
    return event.type === "ad_impression" || event.type === "ad_click";
}

function eventKey(event) {
    return [event.type, event.locale, event.calculator, event.instance].join("|");
}

/* One view per device and calculator, one impression per device and Row ad
   slot/campaign — whatever the display language. The tracker uses the same
   scope, so the server agrees with the browser's own 30-minute guard. */
function windowKey(event) {
    const scope = event.type === "ad_impression"
        ? [event.row, event.campaignId || ""].join("|")
        : event.calculator;

    return [event.type, scope, event.visitor || event.instance].join("|");
}

function ensureDirectory() {
    try {
        fs.mkdirSync(config.ANALYTICS_DATA_DIR, { recursive: true });
    } catch (error) {
        console.error("[analytics] cannot create data directory:", error.message);
    }
}

function load() {
    if (loaded) return;
    loaded = true;
    ensureDirectory();

    const cutoff = Date.now() - config.ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const recentCutoff = Date.now() - config.ANALYTICS_DEDUPE_WINDOW_MS;
    let files = [];

    try {
        files = fs.readdirSync(config.ANALYTICS_DATA_DIR)
            .filter((name) => /^events-\d{4}-\d{2}-\d{2}\.ndjson$/.test(name))
            .sort();
    } catch (error) {
        console.error("[analytics] cannot read data directory:", error.message);
        return;
    }

    for (const name of files) {
        const file = path.join(config.ANALYTICS_DATA_DIR, name);
        const day = name.slice("events-".length, "events-YYYY-MM-DD".length);
        const dayEnd = Date.parse(day + "T23:59:59Z");

        if (Number.isFinite(dayEnd) && dayEnd < cutoff) {
            try {
                fs.unlinkSync(file);
            } catch (error) {
                /* A file held open elsewhere is retried on the next start. */
            }
            continue;
        }

        let text = "";

        try {
            text = fs.readFileSync(file, "utf8");
        } catch (error) {
            console.error("[analytics] cannot read", name + ":", error.message);
            continue;
        }

        for (const line of text.split("\n")) {
            if (!line.trim()) continue;

            let event;

            try {
                event = JSON.parse(line);
            } catch (error) {
                continue;  /* a torn last line is skipped, the rest is kept */
            }

            if (!event || !EVENT_TYPES.has(event.type) || !event.instance) continue;

            const key = eventKey(event);
            if (dedupeKeys.has(key)) continue;

            dedupeKeys.add(key);
            events.push(event);

            /* Rebuild the recent window so a restart does not forget that this
               visitor already had a view/impression recorded moments ago. */
            if (WINDOW_TYPES.has(event.type) && event.ts >= recentCutoff) {
                const scope = windowKey(event);
                const previous = recentWindow.get(scope) || 0;

                if (event.ts > previous) recentWindow.set(scope, event.ts);
            }
        }
    }

    if (events.length > config.ANALYTICS_MAX_EVENTS) {
        events = events.slice(events.length - config.ANALYTICS_MAX_EVENTS);
    }
}

function appendToDisk(event) {
    ensureDirectory();
    const file = path.join(config.ANALYTICS_DATA_DIR, "events-" + event.date + ".ndjson");
    fs.appendFileSync(file, JSON.stringify(event) + "\n", "utf8");
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

function cleanText(value, maxLength) {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLength);
}

function validDateKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T00:00:00Z"));
}

function normalizeLocale(value) {
    const locale = cleanText(value, 12).toLowerCase();
    return /^[a-z]{2,3}(-[a-z]{2,4})?$/.test(locale) ? locale : "";
}

function normalizeCampaignId(value, row) {
    const campaign = cleanText(value, 64);
    if (/^[a-z0-9._:-]{1,64}$/i.test(campaign)) return campaign;
    return "row-" + row;
}

/**
 * Records one browser event.
 * @returns {{ recorded: boolean, reason?: string }}
 */
function record(input) {
    load();

    if (input === null || typeof input !== "object" || Array.isArray(input)) {
        return { recorded: false, reason: "invalid" };
    }

    const type = cleanText(input.type, 32);

    if (!EVENT_TYPES.has(type)) {
        return { recorded: false, reason: "invalid" };
    }

    const row = cleanText(input.row, 32);
    const calculator = cleanText(input.calculator, 64);
    const rowInfo = ROWS.get(row);

    if (!rowInfo) {
        return { recorded: false, reason: "invalid" };
    }

    if (ROW_OF_CALCULATOR.get(calculator) !== row) {
        return { recorded: false, reason: "invalid" };
    }

    const locale = normalizeLocale(input.locale);

    if (!locale) {
        return { recorded: false, reason: "invalid" };
    }

    const instance = cleanText(input.eventInstanceId, 64);

    if (!/^[a-z0-9._-]{6,64}$/i.test(instance)) {
        return { recorded: false, reason: "invalid" };
    }

    const visitor = cleanText(input.visitorId, 128);
    const visitorHash = visitor
        ? crypto.createHash("sha256").update(visitor).digest("hex").slice(0, 24)
        : "";

    const now = Date.now();
    const event = {
        type,
        ts: now,
        date: dateKey(now),
        row,
        calculator,
        locale,
        campaignId: type === "ad_impression" || type === "ad_click"
            ? normalizeCampaignId(input.campaignId, row)
            : "",
        path: cleanText(input.path, 200),
        visitor: visitorHash,
        instance
    };

    const key = eventKey(event);

    if (dedupeKeys.has(key)) {
        return { recorded: false, reason: "duplicate" };
    }

    if (WINDOW_TYPES.has(type)) {
        const scope = windowKey(event);
        const previous = recentWindow.get(scope) || 0;

        if (now - previous < config.ANALYTICS_DEDUPE_WINDOW_MS) {
            /* Not stored, but the instance is remembered so a repeated beacon
               is rejected in the same way. */
            dedupeKeys.add(key);
            return { recorded: false, reason: "duplicate" };
        }

        recentWindow.set(scope, now);
    }

    try {
        appendToDisk(event);
    } catch (error) {
        console.error("[analytics] cannot append event:", error.message);
        return { recorded: false, reason: "storage" };
    }

    events.push(event);
    dedupeKeys.add(key);

    if (events.length > config.ANALYTICS_MAX_EVENTS) {
        events = events.slice(events.length - config.ANALYTICS_MAX_EVENTS);
    }

    if (recentWindow.size > 20000) {
        const cutoff = now - config.ANALYTICS_DEDUPE_WINDOW_MS;

        for (const [scope, timestamp] of recentWindow) {
            if (timestamp < cutoff) recentWindow.delete(scope);
        }
    }

    return { recorded: true };
}

/* ------------------------------------------------------------------ *
 * Querying
 * ------------------------------------------------------------------ */

/**
 * Events for one Row inside a closed date range, optionally one campaign.
 * @param {string} rowId
 * @param {{ from: string, to: string, campaignId?: string }} filters
 */
function query(rowId, filters) {
    load();

    const campaignId = filters.campaignId || "";

    return events.filter((event) => {
        if (event.row !== rowId) return false;
        if (event.date < filters.from || event.date > filters.to) return false;
        if (campaignId && isAdEvent(event) && event.campaignId !== campaignId) return false;
        return true;
    });
}

/* Every event in a date range, across all Rows. The master dashboard groups
   these by Row, so it reads exactly the same records as the Row pages. */
function queryRange(filters) {
    load();

    const campaignId = filters.campaignId || "";

    return events.filter((event) => {
        if (event.date < filters.from || event.date > filters.to) return false;
        if (campaignId && isAdEvent(event) && event.campaignId !== campaignId) return false;
        return true;
    });
}

function rowInfo(rowId) {
    return ROWS.get(rowId) || null;
}

function rows() {
    return Array.from(ROWS.values()).map((row) => ({
        id: row.id,
        title: row.title,
        calculators: row.calculators
    }));
}

module.exports = {
    record,
    query,
    queryRange,
    rowInfo,
    rows
};
