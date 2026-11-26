/*
 * API router.
 *
 *   GET  /api/health                      service check
 *   GET  /api/calculators                 calculator slugs the API serves
 *   GET  /api/materials                   density tables as JSON
 *   GET  /api/bootstrap.js                density tables + API base for the pages
 *   POST /api/calculate/:slug             run one calculation
 *   POST /api/analytics/collect           record one analytics event (beacon)
 *   GET  /api/analytics/overview          combined report for every section
 *   GET  /api/analytics/rows/:row         report for one section/row
 *   POST /api/analytics/shares            create a temporary share link (protected)
 *   GET  /api/analytics/shares/:token     token-validated public share report
 *   DELETE /api/analytics/shares/:token   revoke a share link (protected)
 */
"use strict";

const crypto = require("crypto");
const { API_KEY, ANALYTICS_ENABLED, ANALYTICS_KEY, ANALYTICS_PUBLIC } = require("../config");
const { sendJson, sendText, readBody, clientIp } = require("../middleware/http");
const { applyCors } = require("../middleware/cors");
const rateLimit = require("../middleware/rateLimit");
const calculationController = require("../controllers/calculationController");
const materialsController = require("../controllers/materialsController");
const analyticsController = require("../controllers/analyticsController");
const { ValidationError } = require("../core/validation");

function isApi(pathname) {
    return pathname === "/api" || pathname.startsWith("/api/");
}

/* Private analytics reports and share management always require the analytics
   key. When no key is configured the reports are refused (fail closed) unless
   ANALYTICS_PUBLIC=true deliberately publishes them; an unconfigured server
   must never hand the whole site's analytics to the internet. */
function keyMatches(supplied) {
    if (!ANALYTICS_KEY) return false;
    const given = Buffer.from(String(supplied || ""), "utf8");
    const expected = Buffer.from(ANALYTICS_KEY, "utf8");
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/* "ok" | "unauthorized" | "unconfigured" */
function analyticsAccess(req, pathname, search) {
    if (!ANALYTICS_KEY) return ANALYTICS_PUBLIC ? "ok" : "unconfigured";

    const supplied =
        req.headers["x-api-key"] ||
        new URL(pathname + search, "http://localhost").searchParams.get("key");

    return keyMatches(supplied) ? "ok" : "unauthorized";
}

function unauthorized(res) {
    sendJson(res, 401, {
        ok: false,
        error: { message: "Unauthorised. Enter the analytics key to view this report." }
    });
}

function analyticsDenied(res, access) {
    if (access !== "unconfigured") {
        unauthorized(res);
        return;
    }
    sendJson(res, 503, {
        ok: false,
        error: {
            code: "analytics_locked",
            message:
                "Analytics reports are locked on this server. Set ANALYTICS_KEY in the backend environment, " +
                "or ANALYTICS_PUBLIC=true to publish the dashboards deliberately."
        }
    });
}

async function handle(req, res, pathname, search) {
    if (!applyCors(req, res)) {
        sendJson(res, 403, {
            ok: false,
            error: { message: "Origin not allowed." }
        });
        return;
    }

    if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
    }

    if (pathname === "/api/health") {
        sendJson(res, 200, {
            ok: true,
            service: "metal-weight-calculator-api",
            calculators: require("../calculations").list().length
        });
        return;
    }

    if (pathname === "/api/bootstrap.js") {
        res.setHeader("Cache-Control", "no-store");
        sendText(
            res,
            200,
            materialsController.bootstrapScript(),
            "text/javascript"
        );
        return;
    }

    if (pathname === "/api/materials") {
        sendJson(res, 200, materialsController.materialsJson());
        return;
    }

    if (pathname === "/api/calculators") {
        sendJson(res, 200, calculationController.list());
        return;
    }

    /* ------------------------------------------------------------------
       Analytics
    ------------------------------------------------------------------ */
    if (pathname === "/api/analytics/collect") {
        if (!ANALYTICS_ENABLED) {
            res.statusCode = 204;
            res.end();
            return;
        }

        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            sendJson(res, 405, { ok: false, error: { message: "Use POST for analytics events." } });
            return;
        }

        const limit = rateLimit.check("analytics:" + clientIp(req));
        if (!limit.allowed) {
            res.setHeader("Retry-After", String(limit.retryAfter));
            sendJson(res, 429, { ok: false, error: { message: "Too many analytics events. Please wait a moment." } });
            return;
        }

        const payload = await readBody(req);
        const result = analyticsController.collect(payload);

        if (result.status === 204) {
            res.statusCode = 204;
            res.end();
            return;
        }

        sendJson(res, result.status, result.body);
        return;
    }

    if (pathname === "/api/analytics/overview") {
        if (!ANALYTICS_ENABLED) {
            sendJson(res, 404, { ok: false, error: { message: "Analytics are disabled on this deployment." } });
            return;
        }
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET");
            sendJson(res, 405, { ok: false, error: { message: "Use GET for analytics reports." } });
            return;
        }
        const access = analyticsAccess(req, pathname, search);
        if (access !== "ok") {
            analyticsDenied(res, access);
            return;
        }
        const combined = analyticsController.overview(new URL(pathname + search, "http://localhost").searchParams);
        sendJson(res, combined.status, combined.body);
        return;
    }

    if (pathname === "/api/analytics/shares") {
        if (!ANALYTICS_ENABLED) {
            sendJson(res, 404, { ok: false, error: { message: "Analytics are disabled on this deployment." } });
            return;
        }
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            sendJson(res, 405, { ok: false, error: { message: "Use POST to create share links." } });
            return;
        }
        const access = analyticsAccess(req, pathname, search);
        if (access !== "ok") {
            analyticsDenied(res, access);
            return;
        }
        const limit = rateLimit.check("share-create:" + clientIp(req));
        if (!limit.allowed) {
            res.setHeader("Retry-After", String(limit.retryAfter));
            sendJson(res, 429, { ok: false, error: { message: "Too many share requests. Please wait a moment." } });
            return;
        }
        const payload = await readBody(req);
        const created = analyticsController.createShare(payload);
        sendJson(res, created.status, created.body);
        return;
    }

    if (pathname.startsWith("/api/analytics/shares/")) {
        if (!ANALYTICS_ENABLED) {
            sendJson(res, 404, { ok: false, error: { message: "Analytics are disabled on this deployment." } });
            return;
        }

        const token = decodeURIComponent(pathname.slice("/api/analytics/shares/".length)).split("/")[0];
        const searchParams = new URL(pathname + search, "http://localhost").searchParams;

        if (req.method === "GET") {
            const limit = rateLimit.check("share-read:" + clientIp(req));
            if (!limit.allowed) {
                res.setHeader("Retry-After", String(limit.retryAfter));
                sendJson(res, 429, { ok: false, error: { message: "Too many requests. Please wait a moment." } });
                return;
            }
            const report = analyticsController.shareReport(token, searchParams);
            sendJson(res, report.status, report.body);
            return;
        }

        if (req.method === "DELETE" || req.method === "POST") {
            const access = analyticsAccess(req, pathname, search);
            if (access !== "ok") {
                analyticsDenied(res, access);
                return;
            }
            const revoked = analyticsController.revokeShare(token);
            sendJson(res, revoked.status, revoked.body);
            return;
        }

        res.setHeader("Allow", "GET, POST, DELETE");
        sendJson(res, 405, { ok: false, error: { message: "Method not allowed for share links." } });
        return;
    }

    if (pathname.startsWith("/api/analytics/rows/")) {
        if (!ANALYTICS_ENABLED) {
            sendJson(res, 404, { ok: false, error: { message: "Analytics are disabled on this deployment." } });
            return;
        }
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET");
            sendJson(res, 405, { ok: false, error: { message: "Use GET for analytics reports." } });
            return;
        }
        const access = analyticsAccess(req, pathname, search);
        if (access !== "ok") {
            analyticsDenied(res, access);
            return;
        }
        const rowId = decodeURIComponent(pathname.slice("/api/analytics/rows/".length));
        const report = analyticsController.report(rowId, new URL(pathname + search, "http://localhost").searchParams);
        sendJson(res, report.status, report.body);
        return;
    }

    if (pathname.startsWith("/api/calculate/")) {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            sendJson(res, 405, { ok: false, error: { message: "Use POST for calculations." } });
            return;
        }

        if (API_KEY && req.headers["x-api-key"] !== API_KEY) {
            sendJson(res, 401, { ok: false, error: { message: "Unauthorised." } });
            return;
        }

        const limit = rateLimit.check(clientIp(req));
        if (!limit.allowed) {
            res.setHeader("Retry-After", String(limit.retryAfter));
            sendJson(res, 429, { ok: false, error: { message: "Too many calculations. Please wait a moment." } });
            return;
        }

        const slug = decodeURIComponent(pathname.slice("/api/calculate/".length));
        const payload = await readBody(req);

        try {
            const body = calculationController.calculate(slug, payload);
            sendJson(res, 200, body);
        } catch (error) {
            if (error instanceof ValidationError) {
                sendJson(res, error.status || 400, {
                    ok: false,
                    error: { message: error.message, field: error.field || null }
                });
                return;
            }
            throw error;
        }

        return;
    }

    sendJson(res, 404, { ok: false, error: { message: "Unknown API route: " + pathname } });
}

module.exports = { isApi, handle };
