#!/usr/bin/env node
/* Verify that every page links to its exact counterpart in every language.
 *
 *   node tools/verify_runtime_switcher.js
 *
 * For each of the site's pages (English homepage, about page, every
 * calculator, and all their generated language versions) every entry in the
 * visible language menu is resolved and compared with the page that is
 * supposed to open. A link that points at the language homepage instead of
 * the equivalent calculator is reported as a failure.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, "frontend/i18n/languages.json"), "utf8")).languages;
const CODES = LANGS.map((item) => item.code);

/* ---------------- page inventory ---------------- */

function collectPages() {
  const pages = ["index.html", "frontend/about/index.html"];
  const calculators = path.join(ROOT, "frontend/calculators");
  for (const name of fs.readdirSync(calculators).sort()) {
    const file = path.join(calculators, name, "index.html");
    if (fs.existsSync(file)) {
      pages.push("frontend/calculators/" + name + "/index.html");
    }
  }
  for (const code of CODES) {
    if (code === "en") continue;
    pages.push(code + "/index.html");
    pages.push(code + "/about/index.html");
    for (const name of fs.readdirSync(calculators).sort()) {
      const file = path.join(calculators, name, "index.html");
      if (fs.existsSync(file)) {
        pages.push(code + "/calculators/" + name + "/index.html");
      }
    }
  }
  return pages;
}

/* What page is this? { code, kind, slug } */
function describe(page) {
  const parts = page.split("/");
  let code = "en";
  if (parts.length > 1 && CODES.includes(parts[0]) && parts[0] !== "en") {
    code = parts[0];
    parts.shift();
  }
  const rest = parts.join("/");
  if (rest === "index.html") return { code, kind: "home", slug: "" };
  const about = rest.match(/^(?:frontend\/)?about\/index\.html$/);
  if (about) return { code, kind: "about", slug: "" };
  const calc = rest.match(/^(?:frontend\/)?calculators\/([^/]+)\/index\.html$/);
  if (calc) return { code, kind: "calculator", slug: calc[1] };
  return null;
}

/* The page a given page should open in a given language. Every URL names the
   HTML file, so it opens directly from a server, a static host or from disk
   without a folder listing in between. */
function expectedUrl(info, code) {
  if (info.kind === "home") {
    return code === "en" ? "/index.html" : "/" + code + "/index.html";
  }
  if (info.kind === "about") {
    return code === "en"
      ? "/frontend/about/index.html"
      : "/" + code + "/about/index.html";
  }
  return code === "en"
    ? "/frontend/calculators/" + info.slug + "/index.html"
    : "/" + code + "/calculators/" + info.slug + "/index.html";
}

/* Normalize a URL path so /a/b, /a/b/ and /a/b/index.html compare equal. */
function normalize(urlPath) {
  let value = urlPath.replace(/index\.html$/, "");
  if (!value.endsWith("/")) value += "/";
  return value;
}

function pageUrl(page) {
  const dir = path.posix.dirname(page);
  return "/" + (dir === "." ? "" : dir + "/");
}

function resolveUrl(fromPath, href) {
  const parsed = new URL(href, "http://site" + fromPath);
  return parsed.pathname;
}

/* ---------------- menu inspection ---------------- */

const MENU_RE = /<ul class="lang-switch__menu"[^>]*>([\s\S]*?)<\/ul>/i;
const LINK_RE = /<a\b[^>]*?href="([^"]*)"[^>]*?hreflang="([^"]+)"/gi;

function menuLinks(html) {
  const menu = MENU_RE.exec(html);
  if (!menu) return null;
  const links = [];
  let match;
  while ((match = LINK_RE.exec(menu[1]))) {
    links.push({ href: match[1], code: match[2] });
  }
  return links;
}

/* ---------------- runtime safety net ---------------- */

const SOURCE = fs.readFileSync(path.join(ROOT, "frontend/i18n/language-switcher.js"), "utf8");

/* Run the switcher with placeholder hrefs and a realistic document, then
   confirm it repairs them from the alternates without touching real links. */
function runSafetyNet(page, alternates) {
  const links = CODES.map((code) => ({
    code,
    href: "#",
    getAttribute(name) {
      if (name === "hreflang") return this.code;
      if (name === "href") return this.href;
      return null;
    },
    setAttribute(name, value) {
      if (name === "href") this.href = value;
    },
    addEventListener() {},
  }));
  const lang = describe(page).code;
  const context = {
    location: { pathname: pageUrl(page), href: "http://site" + pageUrl(page) },
    URL,
    document: {
      documentElement: { getAttribute: () => lang },
      querySelector(selector) {
        return selector === ".lang-switch"
          ? {
              querySelectorAll: (sel) => (sel === ".lang-switch__menu a" ? links : []),
              removeAttribute() {},
              open: false,
              contains() {
                return false;
              },
            }
          : null;
      },
      querySelectorAll(selector) {
        if (selector !== 'link[rel="alternate"][hreflang]') return [];
        return alternates.map((item) => ({
          getAttribute: (name) => (name === "hreflang" ? item.code : name === "href" ? item.href : null),
        }));
      },
      addEventListener() {},
    },
    localStorage: { getItem: () => "en", setItem() {} },
    sessionStorage: { getItem: () => "en", setItem() {} },
    console,
  };
  vm.runInNewContext(SOURCE, context, { filename: "language-switcher.js" });
  const result = {};
  for (const link of links) result[link.code] = link.href;
  return result;
}

/* ---------------- audit ---------------- */

const problems = [];
let checkedPages = 0;
let checkedLinks = 0;

for (const page of collectPages()) {
  const info = describe(page);
  if (!info) {
    problems.push(page + ": unrecognised page path");
    continue;
  }
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  const links = menuLinks(html);
  if (!links) {
    problems.push(page + ": no language menu");
    continue;
  }
  checkedPages += 1;

  const seen = new Set();
  for (const link of links) {
    checkedLinks += 1;
    if (!CODES.includes(link.code)) {
      problems.push(page + ": unknown language in menu: " + link.code);
      continue;
    }
    seen.add(link.code);
    if (!link.href || link.href === "#") {
      /* English source pages intentionally ship placeholder hrefs. Their
         runtime switcher repairs them from the hreflang alternates below. */
      if (info.code !== "en") {
        problems.push(page + " -> " + link.code + ": placeholder href");
      }
      continue;
    }
    /* Generated pages use clean folder URLs. normalize() accepts them just
       as it accepts an explicit index.html file. */
    const actual = normalize(resolveUrl(pageUrl(page), link.href));
    const expected = normalize(expectedUrl(info, link.code));
    if (actual !== expected) {
      problems.push(page + " -> " + link.code + ": " + link.href + " (" + actual + ") expected " + expected);
      continue;
    }
    const targetFile = actual + "index.html";
    if (!fs.existsSync(path.join(ROOT, targetFile.replace(/^\//, "")))) {
      problems.push(page + " -> " + link.code + ": missing file " + targetFile);
    }
  }
  for (const code of CODES) {
    if (!seen.has(code)) {
      problems.push(page + ": menu has no " + code + " entry");
    }
  }

  /* English pages ship placeholder menu links, so their runtime safety net
     must rebuild every target exactly. Alternates are published as clean SEO
     URLs; the switcher must add index.html so the link works from disk too. */
  const alternates = CODES.map((code) => ({
    code,
    href: "https://metalweightcalculator.online" + expectedUrl(info, code).replace(/index\.html$/, ""),
  }));
  if (info.code === "en") {
    const repaired = runSafetyNet(page, alternates);
    for (const code of CODES) {
      checkedLinks += 1;
      if (normalize(repaired[code]) !== normalize(expectedUrl(info, code))) {
        problems.push(page + " safety net -> " + code + ": " + repaired[code]);
      }
      if (!repaired[code].endsWith("index.html")) {
        problems.push(page + " safety net -> " + code + " is not a file: " + repaired[code]);
      }
    }

    /* A language whose page is missing must fall back to that language's home
       page, never to a folder and never to a dead link. */
    const partial = alternates.filter((item) => item.code !== "ja");
    const fallback = runSafetyNet(page, partial);
    if (fallback.ja !== "/ja/index.html") {
      problems.push(page + " missing-language fallback: " + fallback.ja);
    }
  }
}

console.log(
  "checked " + checkedLinks + " language links across " + checkedPages + " pages; " +
  CODES.length + " languages; " + problems.length + " problems"
);
for (const problem of problems.slice(0, 120)) console.log("  " + problem);
process.exit(problems.length ? 1 : 0);
