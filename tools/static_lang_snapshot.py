#!/usr/bin/env python3
"""Capture the current in-place translation output for every page/language.

This tool is READ-ONLY for the website. It serves the workspace on localhost,
loads the original English pages in headless Chrome, drives the existing
Translation button through window.MW_I18N.switchTo(), and stores the exact
visible strings that the site produces.

    python tools/static_lang_snapshot.py --out .tmp/static-lang-snapshot.json

The generated JSON is the reference used by tools/build_static_languages.py to
pre-render the separate language-specific pages.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WRAPPER_NAME = "__mw_static_lang_snapshot.html"
CHROME = os.environ.get(
    "CHROME_PATH", r"C:\Program Files\Google\Chrome\Application\chrome.exe"
)
PORT = int(os.environ.get("MW_SNAPSHOT_PORT", "8766"))
BASE = f"http://127.0.0.1:{PORT}"


WRAPPER = r"""<!doctype html>
<meta charset="utf-8">
<title>Static language snapshot</title>
<pre id="result">PENDING</pre>
<div id="frames"></div>
<script>
(function () {
  "use strict";
  var q = new URLSearchParams(location.search);
  var page = q.get("page") || "index.html";
  var langs = (q.get("langs") || "").split(",").filter(Boolean);
  var result = document.getElementById("result");
  var host = document.getElementById("frames");
  var out = { page: page, languages: {}, errors: [] };
  var SKIP = ".lang-switch, script, style, textarea, code, pre, kbd, samp, [data-i18n-skip]";
  var ATTRS = ["placeholder", "aria-label", "title", "alt"];

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function ready(win, ms) {
    var deadline = Date.now() + (ms || 6000);
    while (Date.now() < deadline) {
      if (win.document && win.document.readyState === "complete" && win.MW_I18N) {
        return true;
      }
      await sleep(20);
    }
    return false;
  }

  function sources(win) {
    var d = win.document;
    var seen = Object.create(null);
    var values = [];
    function add(value) {
      var text = String(value == null ? "" : value).trim();
      if (text && !seen[text]) { seen[text] = true; values.push(text); }
    }
    var walker = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      var node = walker.currentNode;
      var parent = node.parentElement;
      if (!parent || !parent.closest || parent.closest(SKIP)) { continue; }
      add(node.nodeValue);
    }
    Array.prototype.forEach.call(
      d.querySelectorAll("[placeholder], [aria-label], [title], [alt]"),
      function (el) {
        if (el.closest && el.closest(SKIP)) { return; }
        ATTRS.forEach(function (name) {
          if (el.hasAttribute(name)) { add(el.getAttribute(name)); }
        });
      }
    );
    return values;
  }

  function meta(win) {
    var d = win.document;
    function content(selector) {
      var el = d.querySelector(selector);
      return el ? (el.getAttribute("content") || "") : "";
    }
    function attr(selector, name) {
      var el = d.querySelector(selector);
      return el ? (el.getAttribute(name) || "") : "";
    }
    function text(selector) {
      var el = d.querySelector(selector);
      return el ? (el.textContent || "").trim() : "";
    }
    return {
      title: d.title,
      description: content('meta[name="description"]'),
      ogTitle: content('meta[property="og:title"]'),
      ogDescription: content('meta[property="og:description"]'),
      ogSiteName: content('meta[property="og:site_name"]'),
      twitterTitle: content('meta[name="twitter:title"]'),
      twitterDescription: content('meta[name="twitter:description"]'),
      appleTitle: content('meta[name="apple-mobile-web-app-title"]'),
      ogLocale: content('meta[property="og:locale"]'),
      switcherAria: attr(".lang-switch summary", "aria-label"),
      switcherTitle: attr(".lang-switch summary", "title"),
      switcherFull: text(".lang-switch .lang-switch__label-full"),
      switcherShort: text(".lang-switch .lang-switch__label-short")
    };
  }

  /* Load languages one at a time. Ten simultaneous calculator iframes can
     starve the dictionary script loads and produce empty translation maps. */
  async function capture(lang) {
    var frame = document.createElement("iframe");
    frame.style.cssText = "width:1280px;height:900px;border:0";
    frame.dataset.lang = lang;
    host.appendChild(frame);
    try {
      await new Promise(function (resolve) {
        frame.addEventListener("load", resolve, { once: true });
        frame.src = page;
      });
      var win = frame.contentWindow;
      if (!(await ready(win))) { throw new Error("runtime not ready"); }
      /* localStorage is shared by the wrapper, so an earlier language can
         make this fresh iframe start translated. Always return it to English
         before recording the source strings. */
      if (win.MW_I18N.language !== "en") {
        await win.MW_I18N.switchTo("en");
        await sleep(500);
      }
      var originals = sources(win);
      if (win.MW_I18N.clearMissingTranslations) {
        win.MW_I18N.clearMissingTranslations();
      }
      if (lang !== "en") {
        await win.MW_I18N.switchTo(lang);
        if (win.MW_I18N.language !== lang) {
          throw new Error("language did not switch to " + lang);
        }
        /* switchTo resolves after the script tag has loaded, but be certain
           the dictionary object is actually present before translating. */
        var deadline = Date.now() + 5000;
        while (!(win.MW_I18N_DICTIONARIES && win.MW_I18N_DICTIONARIES[lang]) &&
               Date.now() < deadline) {
          await sleep(20);
        }
        if (!(win.MW_I18N_DICTIONARIES && win.MW_I18N_DICTIONARIES[lang])) {
          throw new Error("dictionary not loaded");
        }
        await sleep(500);
      }
      var translated = {};
      originals.forEach(function (source) {
        var value = win.MW_I18N.t(source);
        if (value !== null && value !== undefined && String(value) !== source) {
          translated[source] = String(value);
        }
      });
      out.languages[lang] = {
        text: translated,
        attrs: translated,
        meta: meta(win),
        missing: win.MW_I18N.missingTranslations ? win.MW_I18N.missingTranslations() : []
      };
    } catch (error) {
      out.errors.push(lang + ": " + String(error && error.message || error));
    } finally {
      frame.remove();
    }
  }

  (async function () {
    for (var i = 0; i < langs.length; i += 1) { await capture(langs[i]); }
    result.textContent = JSON.stringify(out);
    result.setAttribute("data-done", "1");
  })();
})();
</script>
"""


def snapshot_page(page: str, languages: list[str], timeout_ms: int = 20000) -> dict:
    wrapper_path = ROOT / WRAPPER_NAME
    wrapper_path.write_text(WRAPPER, encoding="utf-8")
    params = urllib.parse.urlencode({"page": page, "langs": ",".join(languages)})
    url = f"{BASE}/{WRAPPER_NAME}?{params}"
    user_dir = tempfile.mkdtemp(prefix="mw-static-snapshot-")
    command = [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-sync",
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
        f"--user-data-dir={user_dir}",
        f"--virtual-time-budget={timeout_ms}",
        "--dump-dom",
        url,
    ]
    try:
        process = subprocess.run(
            command, capture_output=True, text=True, timeout=900,
            encoding="utf-8", errors="replace",
        )
    finally:
        wrapper_path.unlink(missing_ok=True)
    match = re.search(r'<pre id="result"[^>]*>(.*?)</pre>', process.stdout, re.S)
    if not match:
        return {"page": page, "errors": [f"no result from Chrome: {process.stderr[-600:]}"]}
    payload = html.unescape(match.group(1)).strip()
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return {"page": page, "errors": [f"invalid result JSON: {payload[:600]}"]}


def source_pages() -> list[str]:
    return ["index.html", "frontend/about/index.html"] + [
        f"frontend/calculators/{path.name}/index.html"
        for path in sorted((ROOT / "frontend" / "calculators").iterdir())
        if path.is_dir() and (path / "index.html").is_file()
    ]


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=".tmp/static-lang-snapshot.json")
    parser.add_argument("--pages", nargs="*", help="Optional subset of source pages")
    parser.add_argument("--languages", default="mr,hi,en,de,es,fr,ja,zh,pt,ar")
    parser.add_argument("--timeout", type=int, default=600000)
    args = parser.parse_args()

    languages = [code for code in args.languages.split(",") if code]
    pages = args.pages or source_pages()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(ROOT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    result = {"version": 2, "languages": languages, "pages": {}}
    try:
        time.sleep(1.0)
        for index, page in enumerate(pages, 1):
            print(f"[{index}/{len(pages)}] {page}", flush=True)
            result["pages"][page] = snapshot_page(page, languages, args.timeout)
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()

    output = ROOT / args.out
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    errors = []
    for page, data in result["pages"].items():
        for error in data.get("errors", []):
            errors.append(f"{page}: {error}")
    print(f"wrote {output} ({len(result['pages'])} pages, {len(errors)} errors)")
    for error in errors[:30]:
        print("  " + error)
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
