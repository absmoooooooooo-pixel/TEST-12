/*
 * Share-link store for analytics dashboards.
 *
 * Tokens are capability URLs: anyone with the token can read the scoped
 * analytics report until it expires or is revoked. Tokens are generated with
 * crypto.randomBytes and stored only as SHA-256 hashes on disk.
 *
 * Records live in backend/analytics/shares.json (git-ignored in data dir by
 * default path config? we store next to analytics data; keep in analytics dir).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const config = require("../config");

const FILE = path.join(path.dirname(config.ANALYTICS_DATA_DIR), "shares.json");
const TOKEN_BYTES = 32;
const MAX_TTL_MS = 31 * 24 * 60 * 60 * 1000; // 31 days upper bound
const ALLOWED_TTL_MS = new Set([
    5 * 60 * 1000,
    10 * 60 * 1000,
    60 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000,
    30 * 24 * 60 * 60 * 1000
]);

let loaded = false;
let records = [];

function ensureDir() {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
}

function load() {
    if (loaded) return;
    loaded = true;
    ensureDir();
    try {
        if (!fs.existsSync(FILE)) {
            records = [];
            return;
        }
        const raw = fs.readFileSync(FILE, "utf8");
        const parsed = JSON.parse(raw);
        records = Array.isArray(parsed) ? parsed.filter(isValidRecord) : [];
    } catch (error) {
        console.error("[analytics] cannot read shares.json:", error.message);
        records = [];
    }
}

function isValidRecord(r) {
    return r && typeof r === "object" && typeof r.id === "string" &&
        typeof r.tokenHash === "string" && typeof r.rowId === "string" &&
        typeof r.createdAt === "number" && typeof r.expiresAt === "number";
}

function persist() {
    ensureDir();
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(records, null, 2) + "\n", "utf8");
    fs.renameSync(tmp, FILE);
}

function hashToken(token) {
    return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function cleanRowId(rowId) {
    const value = String(rowId || "").trim().toLowerCase();
    return /^[a-z0-9][a-z0-9-]{0,31}$/.test(value) ? value : "";
}

function create(rowId, ttlMs) {
    load();
    const row = cleanRowId(rowId);
    if (!row) return { ok: false, error: "invalid_row" };

    const ttl = Number(ttlMs);
    if (!ALLOWED_TTL_MS.has(ttl)) return { ok: false, error: "invalid_ttl" };

    const now = Date.now();
    const token = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
    const record = {
        id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"),
        tokenHash: hashToken(token),
        rowId: row,
        createdAt: now,
        expiresAt: now + ttl,
        revokedAt: null
    };

    records.push(record);
    // Opportunistic cleanup of old expired/revoked records older than 90 days.
    const cutoff = now - 90 * 24 * 60 * 60 * 1000;
    records = records.filter((r) => r.expiresAt > cutoff || r.revokedAt > cutoff);
    persist();

    return {
        ok: true,
        share: {
            token,
            rowId: row,
            createdAt: new Date(record.createdAt).toISOString(),
            expiresAt: new Date(record.expiresAt).toISOString()
        }
    };
}

function resolve(token) {
    load();
    const raw = String(token || "").trim();
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(raw)) {
        return { ok: false, reason: "invalid" };
    }
    const tokenHash = hashToken(raw);
    const record = records.find((r) => r.tokenHash === tokenHash);
    if (!record) return { ok: false, reason: "not_found" };
    if (record.revokedAt) return { ok: false, reason: "revoked", record: publicRecord(record) };
    if (Date.now() >= record.expiresAt) return { ok: false, reason: "expired", record: publicRecord(record) };
    return { ok: true, record: publicRecord(record) };
}

function revoke(token) {
    load();
    const raw = String(token || "").trim();
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(raw)) return { ok: false, reason: "invalid" };
    const tokenHash = hashToken(raw);
    const record = records.find((r) => r.tokenHash === tokenHash);
    if (!record) return { ok: false, reason: "not_found" };
    if (!record.revokedAt) {
        record.revokedAt = Date.now();
        persist();
    }
    return { ok: true, record: publicRecord(record) };
}

function publicRecord(record) {
    return {
        id: record.id,
        rowId: record.rowId,
        createdAt: new Date(record.createdAt).toISOString(),
        expiresAt: new Date(record.expiresAt).toISOString(),
        revokedAt: record.revokedAt ? new Date(record.revokedAt).toISOString() : null
    };
}

module.exports = {
    create,
    resolve,
    revoke,
    ALLOWED_TTL_MS
};
