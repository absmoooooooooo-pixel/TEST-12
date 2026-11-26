#!/usr/bin/env python3
"""Verify every generated language page against the current in-place translation.

    python tools/verify_all_static_languages.py --all

One headless Chrome session loads every source/generated pair, applies test
inputs, calculates, and compares visible text, attributes, form state and
results. The original English pages are compared to themselves so all ten
languages are covered.
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
WRAPPER_NAME = "__mw_verify_all_static.html"
DATA_NAME = "__mw_verify_all_pairs.json"
CHROME = os.environ.get("CHROME_PATH", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
PORT = int(os.environ.get("MW_VERIFY_PORT", "8771"))
BASE = f"http://127.0.0.1:{PORT}"

DEFAULT_VALUES = {
    "a": "100", "b": "50", "h": "30", "t": "10", "tf": "10", "tw": "10",
    "length": "1000", "width": "100", "diameter": "100", "thickness": "10",
    "od": "100", "id": "50", "wall": "5", "holes": "4", "holeDiameter": "10",
    "pcd": "80", "legA": "50", "legB": "50", "height": "100",
    "largeDiameter": "200", "smallDiameter": "100", "density": "7.85",
    "customDensity": "7.85", "quantity": "10",
}

WRAPPER = r"""<!doctype html>
<meta charset="utf-8">
<title>Verify all generated language pages</title>
<pre id="result">PENDING</pre>
<script>
(function () {
  "use strict";
  var q = new URLSearchParams(location.search);
  /* The pair list is too large for a Windows command line, so it is served as
     a local JSON file and fetched by the wrapper. */
  var dataUrl = q.get("data") || "__mw_verify_all_pairs.json";
  var pairs = [];
  var values = {};
  var result = document.getElementById("result");
  var SKIP = ".lang-switch, .weight-unit-switch, script, style, textarea, code, pre, kbd, samp, [data-i18n-skip]";
  var ATTRS = ["placeholder", "aria-label", "title", "alt"];
  var out = { pairs: [], failures: 0, errors: [] };

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function ready(win, ms) {
    var deadline = Date.now() + (ms || 8000);
    while (Date.now() < deadline) {
      if (win.document && win.document.readyState === "complete" && win.MW_I18N) { return true; }
      await sleep(20);
    }
    return false;
  }

  function load(url) {
    return new Promise(function (resolve) {
      var frame = document.createElement("iframe");
      frame.style.cssText = "width:1280px;height:900px;border:0";
      frame.addEventListener("load", async function () {
        var win = frame.contentWindow;
        var error = null;
        try {
          if (!(await ready(win))) { throw new Error("runtime not ready: " + url); }
        } catch (e) { error = String(e && e.message || e); }
        resolve({ win: error ? null : win, frame: frame, error: error });
      });
      document.body.appendChild(frame);
      frame.src = url;
    });
  }

  function canonicalNumber(win, raw) {
    var text = String(raw == null ? "" : raw).trim();
    var match = text.match(/[-+0-9\u0660-\u0669\u06f0-\u06f9\u0966-\u096f\uFF10-\uFF19.,\u066B\u066C]+/);
    if (!match) { return text; }
    if (win.MWNumber && typeof win.MWNumber.parse === "function") {
      var value = win.MWNumber.parse(match[0]);
      if (isFinite(value)) { return value; }
    }
    return match[0];
  }

  function snapshot(win) {
    var d = win.document;
    var texts = [];
    var walker = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      var node = walker.currentNode;
      var parent = node.parentElement;
      if (!parent || !parent.closest || parent.closest(SKIP)) { continue; }
      var value = node.nodeValue.trim();
      if (value) { texts.push(value); }
    }
    var attrs = [];
    Array.prototype.forEach.call(d.querySelectorAll("[placeholder], [aria-label], [title], [alt]"), function (el) {
      if (el.closest && el.closest(SKIP)) { return; }
      ATTRS.forEach(function (name) {
        if (el.hasAttribute(name)) {
          attrs.push({ id: el.id || "", tag: el.tagName, a: name, v: (el.getAttribute(name) || "").trim() });
        }
      });
    });
    var inputs = Array.prototype.map.call(d.querySelectorAll("input, select, textarea"), function (el) {
      return { id: el.id, value: el.value, options: el.tagName === "SELECT"
        ? Array.prototype.map.call(el.options, function (o) { return o.text; }) : undefined };
    });
    var results = {};
    Array.prototype.forEach.call(
      d.querySelectorAll("[id*=weight i], [id*=result i], [id*=total i], [id*=density i], [id*=kg i], [id*=lb i]"),
      function (el) {
        if (!el.id) { return; }
        var raw = typeof el.value === "string" ? el.value : (el.textContent || "");
        results[el.id] = { raw: raw.trim(), value: canonicalNumber(win, raw) };
      }
    );
    return {
      title: d.title, lang: d.documentElement.lang, dir: d.documentElement.dir,
      texts: texts, attrs: attrs, inputs: inputs, results: results
    };
  }

  function applyValues(win) {
    Object.keys(values).forEach(function (id) {
      var el = win.document.getElementById(id);
      if (!el) { return; }
      el.value = values[id];
      el.dispatchEvent(new win.Event("input", { bubbles: true }));
      el.dispatchEvent(new win.Event("change", { bubbles: true }));
    });
  }

  function calculate(win) {
    var candidates = Array.prototype.slice.call(win.document.querySelectorAll("button, input[type=button], a[role=button]"));
    var target = candidates.find(function (el) {
      return /calculate/i.test(el.id || "") || /calculate/i.test(el.textContent || "");
    });
    if (target) { target.click(); return target.id || target.textContent.trim(); }
    return null;
  }

  function compare(reference, generated, label) {
    var diffs = [];
    if (reference.lang !== generated.lang) { diffs.push(label + ": html lang " + reference.lang + " != " + generated.lang); }
    if (reference.dir !== generated.dir) { diffs.push(label + ": dir " + reference.dir + " != " + generated.dir); }
    if (reference.title !== generated.title) { diffs.push(label + ": title " + reference.title + " != " + generated.title); }
    if (reference.texts.length !== generated.texts.length) {
      diffs.push(label + ": text count " + reference.texts.length + " != " + generated.texts.length);
    }
    var length = Math.min(reference.texts.length, generated.texts.length);
    for (var i = 0; i < length; i += 1) {
      if (reference.texts[i] !== generated.texts[i] && diffs.length < 20) {
        diffs.push(label + ": text[" + i + "] " + JSON.stringify(reference.texts[i]) + " != " + JSON.stringify(generated.texts[i]));
      }
    }
    if (reference.attrs.length !== generated.attrs.length) {
      diffs.push(label + ": attribute count " + reference.attrs.length + " != " + generated.attrs.length);
    }
    reference.attrs.forEach(function (item, index) {
      var other = generated.attrs[index];
      if (!other || item.id !== other.id || item.a !== other.a || item.v !== other.v) {
        if (diffs.length < 20) { diffs.push(label + ": attr[" + index + "] " + JSON.stringify(item) + " != " + JSON.stringify(other)); }
      }
    });
    reference.inputs.forEach(function (item) {
      var other = generated.inputs.find(function (candidate) { return candidate.id === item.id; });
      if (!other) { diffs.push(label + ": missing input " + item.id); return; }
      if (item.value !== other.value) { diffs.push(label + ": input " + item.id + " differs"); }
      if (JSON.stringify(item.options) !== JSON.stringify(other.options)) { diffs.push(label + ": options " + item.id + " differ"); }
    });
    Object.keys(reference.results).forEach(function (id) {
      var other = generated.results[id];
      if (!other) { diffs.push(label + ": missing result " + id); return; }
      if (reference.results[id].value !== other.value) { diffs.push(label + ": result " + id + " differs"); }
    });
    return diffs;
  }

  async function runPair(pair) {
    var entry = { source: pair.source, generated: pair.generated, lang: pair.lang, diffs: [], errors: [] };
    var reference = null;
    var generated = null;
    /* Every pair must start with an empty history. The wrapper shares one
       origin, so calculations from earlier pairs otherwise leak into later
       snapshots and shift the text indices. */
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    try {
      reference = await load(pair.source);
      if (!reference.win) { throw new Error(reference.error || "source page did not load"); }
      await sleep(200);
      /* The wrapper shares localStorage across pairs. Reset each reference
         page to English so its source strings match the pre-rendered pages. */
      if (reference.win.MW_I18N.language !== "en") {
        await reference.win.MW_I18N.switchTo("en");
        await sleep(60);
      }
      if (pair.lang !== "en") {
        await reference.win.MW_I18N.switchTo(pair.lang);
        await sleep(80);
      }
      /* Compare the translated page as it stands after loading. Applying test
         values afterwards makes some calculators re-render worked examples
         with the live locale, which is a runtime formatting concern rather
         than a pre-rendered text difference. */
      var referenceText = snapshot(reference.win);
      applyValues(reference.win);
      await sleep(60);
      reference.calculateTarget = calculate(reference.win);
      await sleep(140);

      try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
      generated = await load(pair.generated);
      if (!generated.win) { throw new Error(generated.error || "generated page did not load"); }
      await sleep(200);
      var languageDeadline = Date.now() + 3000;
      while (generated.win.MW_I18N.language !== pair.lang && Date.now() < languageDeadline) {
        await sleep(20);
      }
      if (generated.win.MW_I18N.language !== pair.lang) {
        entry.errors.push("generated language is " + generated.win.MW_I18N.language + ", expected " + pair.lang);
      }
      var generatedText = snapshot(generated.win);
      entry.diffs = compare(referenceText, generatedText, pair.source);

      applyValues(generated.win);
      await sleep(60);
      generated.calculateTarget = calculate(generated.win);
      await sleep(140);
      entry.results = {
        reference: reference.calculateTarget,
        generated: generated.calculateTarget
      };
      var referenceResults = snapshot(reference.win).results;
      var generatedResults = snapshot(generated.win).results;
      Object.keys(referenceResults).forEach(function (id) {
        var expected = referenceResults[id];
        var actual = generatedResults[id];
        if (!actual || expected.value !== actual.value) {
          entry.diffs.push(pair.source + ": result " + id + " differs after calculation");
        }
      });
    } catch (error) {
      entry.errors.push(String(error && error.stack || error));
    } finally {
      if (reference && reference.frame) { reference.frame.remove(); }
      if (generated && generated.frame) { generated.frame.remove(); }
    }
    if (entry.diffs.length || entry.errors.length) { out.failures += 1; }
    out.pairs.push(entry);
  }

  (async function () {
    try {
      var response = await fetch(dataUrl);
      var config = await response.json();
      pairs = config.pairs || [];
      values = config.values || {};
      for (var i = 0; i < pairs.length; i += 1) { await runPair(pairs[i]); }
    } catch (error) {
      out.errors.push(String(error && error.stack || error));
    }
    result.textContent = JSON.stringify(out);
    result.setAttribute("data-done", "1");
  })();
})();
</script>
"""


def source_pages() -> list[str]:
    pages = ["index.html", "frontend/about/index.html"]
    pages.extend(
        str(path.relative_to(ROOT)).replace("\\", "/")
        for path in sorted((ROOT / "frontend" / "calculators").glob("*/index.html"))
    )
    return pages


def generated_path(source_page: str, lang: str) -> str:
    if lang == "en":
        return source_page
    if source_page == "index.html":
        return f"{lang}/index.html"
    if source_page == "frontend/about/index.html":
        return f"{lang}/about/index.html"
    slug = source_page.split("/")[-2]
    return f"{lang}/calculators/{slug}/index.html"


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--lang", action="append", help="Limit languages (repeatable)")
    parser.add_argument("--page", action="append", help="Limit source pages (repeatable)")
    parser.add_argument("--values", default=json.dumps(DEFAULT_VALUES))
    parser.add_argument("--timeout", type=int, default=900000)
    args = parser.parse_args()
    if not args.all and not (args.lang and args.page):
        parser.error("use --all, or provide --lang and --page")

    languages = json.loads((ROOT / "frontend" / "i18n" / "languages.json").read_text(encoding="utf-8"))["languages"]
    codes = args.lang or [item["code"] for item in languages]
    pages = args.page or source_pages()

    pairs = []
    for code in codes:
        for source in pages:
            pairs.append({"lang": code, "source": source, "generated": generated_path(source, code)})

    wrapper_path = ROOT / WRAPPER_NAME
    wrapper_path.write_text(WRAPPER, encoding="utf-8")
    data_path = ROOT / DATA_NAME
    data_path.write_text(json.dumps({"pairs": pairs, "values": json.loads(args.values)}), encoding="utf-8")
    url = f"{BASE}/{WRAPPER_NAME}?{urllib.parse.urlencode({'data': DATA_NAME})}"
    user_dir = tempfile.mkdtemp(prefix="mw-verify-all-")
    command = [
        CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
        "--disable-dev-shm-usage", "--disable-extensions",
        "--disable-background-networking", "--disable-component-update",
        "--disable-default-apps", "--no-first-run", "--no-default-browser-check",
        "--disable-sync", "--disable-features=ServiceWorker",
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
        f"--user-data-dir={user_dir}",
        f"--virtual-time-budget={args.timeout}", "--dump-dom", url,
    ]
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(ROOT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        time.sleep(1.0)
        process = subprocess.run(command, capture_output=True, text=True, timeout=1800,
                                 encoding="utf-8", errors="replace")
    finally:
        server.terminate()
        server.wait(timeout=5)
        wrapper_path.unlink(missing_ok=True)
        data_path.unlink(missing_ok=True)

    match = re.search(r'<pre id="result"[^>]*>(.*?)</pre>', process.stdout, re.S)
    if not match:
        print("no result from Chrome: " + process.stderr[-1000:])
        raise SystemExit(1)
    result = json.loads(html.unescape(match.group(1)).strip())
    failures = result.get("failures", 0) + len(result.get("errors", []))
    print(f"checked {len(result.get('pairs', []))} pairs; failures: {failures}")
    for item in result.get("pairs", []):
        if item.get("diffs") or item.get("errors"):
            print(f"FAIL {item['lang']}: {item['source']} -> {item['generated']}")
            for problem in (item.get("errors", []) + item.get("diffs", []))[:12]:
                print("   " + problem)
    for problem in result.get("errors", []):
        print("   harness: " + problem)
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
