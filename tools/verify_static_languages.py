#!/usr/bin/env python3
"""Compare a generated language page against the original translated page.

    python tools/verify_static_languages.py \
        --source frontend/calculators/plate/index.html \
        --generated hi/calculators/plate/index.html --lang hi --mode both

The reference iframe uses the existing Translation button; the generated iframe
opens the pre-rendered language URL directly. Visible text, attributes, form
state and calculation results must agree.
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
WRAPPER_NAME = "__mw_static_lang_verify.html"
CHROME = os.environ.get("CHROME_PATH", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
PORT = int(os.environ.get("MW_VERIFY_PORT", "8767"))
BASE = f"http://127.0.0.1:{PORT}"

WRAPPER = r"""<!doctype html>
<meta charset="utf-8">
<title>Static language verification</title>
<pre id="result">PENDING</pre>
<script>
(function () {
  "use strict";
  var q = new URLSearchParams(location.search);
  var source = q.get("source");
  var generated = q.get("generated");
  var lang = q.get("lang");
  var mode = q.get("mode") || "both";
  var values = {};
  try { values = JSON.parse(q.get("values") || "{}"); } catch (e) {}
  var result = document.getElementById("result");
  /* The weight unit toggle is injected and moved by shared JS at load time.
     Its position is timing-dependent on both pages; exclude it from the text
     comparison, exactly as the language switcher is excluded. */
  var SKIP = ".lang-switch, .weight-unit-switch, script, style, textarea, code, pre, kbd, samp, [data-i18n-skip]";
  var ATTRS = ["placeholder", "aria-label", "title", "alt"];
  var out = { source: source, generated: generated, lang: lang, mode: mode, errors: [] };

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
        try {
          if (!(await ready(win))) { throw new Error("runtime not ready: " + url); }
          resolve({ win: win, frame: frame });
        } catch (error) {
          out.errors.push(String(error && error.message || error));
          resolve({ win: null, frame: frame });
        }
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
      title: d.title,
      lang: d.documentElement.lang,
      dir: d.documentElement.dir,
      texts: texts,
      attrs: attrs,
      inputs: inputs,
      results: results
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
      if (reference.texts[i] !== generated.texts[i] && diffs.length < 40) {
        diffs.push(label + ": text[" + i + "] " + JSON.stringify(reference.texts[i]) + " != " + JSON.stringify(generated.texts[i]));
      }
    }
    if (reference.attrs.length !== generated.attrs.length) {
      diffs.push(label + ": attribute count " + reference.attrs.length + " != " + generated.attrs.length);
    }
    reference.attrs.forEach(function (item, index) {
      var other = generated.attrs[index];
      if (!other || item.id !== other.id || item.a !== other.a || item.v !== other.v) {
        if (diffs.length < 40) { diffs.push(label + ": attr[" + index + "] " + JSON.stringify(item) + " != " + JSON.stringify(other)); }
      }
    });
    reference.inputs.forEach(function (item) {
      var other = generated.inputs.find(function (candidate) { return candidate.id === item.id; });
      if (!other) { diffs.push(label + ": missing input " + item.id); return; }
      if (item.value !== other.value) {
        diffs.push(label + ": input " + item.id + " " + JSON.stringify(item.value) + " != " + JSON.stringify(other.value));
      }
      if (JSON.stringify(item.options) !== JSON.stringify(other.options)) {
        diffs.push(label + ": options " + item.id + " differ");
      }
    });
    Object.keys(reference.results).forEach(function (id) {
      var other = generated.results[id];
      if (!other) { diffs.push(label + ": missing result " + id); return; }
      if (reference.results[id].value !== other.value) {
        diffs.push(label + ": result " + id + " " + reference.results[id].value + " != " + other.value);
      }
    });
    return diffs;
  }

  (async function () {
    try {
      var reference = await load(source);
      if (!reference.win) { throw new Error("reference page did not load"); }
      if (reference.win.MW_I18N.language !== "en") {
        await reference.win.MW_I18N.switchTo("en");
        await sleep(60);
      }
      if (lang !== "en") {
        await reference.win.MW_I18N.switchTo(lang);
        await sleep(80);
      }
      if (mode === "calc" || mode === "both") {
        applyValues(reference.win);
        await sleep(80);
        reference.calculateTarget = calculate(reference.win);
        await sleep(160);
      }
      var generatedRef = await load(generated);
      if (!generatedRef.win) { throw new Error("generated page did not load"); }
      var languageDeadline = Date.now() + 3000;
      while (generatedRef.win.MW_I18N.language !== lang && Date.now() < languageDeadline) {
        await sleep(20);
      }
      if (generatedRef.win.MW_I18N.language !== lang) {
        out.errors.push("generated language is " + generatedRef.win.MW_I18N.language + ", expected " + lang);
      }
      if (mode === "calc" || mode === "both") {
        applyValues(generatedRef.win);
        await sleep(80);
        generatedRef.calculateTarget = calculate(generatedRef.win);
        await sleep(160);
      }
      var referenceSnapshot = snapshot(reference.win);
      var generatedSnapshot = snapshot(generatedRef.win);
      out.diffs = compare(referenceSnapshot, generatedSnapshot, "page");
      out.reference = {
        texts: referenceSnapshot.texts.length,
        results: referenceSnapshot.results,
        calculateTarget: reference.calculateTarget
      };
      out.generated = {
        texts: generatedSnapshot.texts.length,
        results: generatedSnapshot.results,
        calculateTarget: generatedRef.calculateTarget
      };
    } catch (error) {
      out.errors.push(String(error && error.stack || error));
    }
    result.textContent = JSON.stringify(out);
    result.setAttribute("data-done", "1");
  })();
})();
</script>
"""


def verify(source: str, generated: str, language: str, mode: str, values: dict,
           timeout_ms: int = 18000) -> dict:
    wrapper_path = ROOT / WRAPPER_NAME
    wrapper_path.write_text(WRAPPER, encoding="utf-8")
    params = urllib.parse.urlencode({
        "source": source, "generated": generated, "lang": language,
        "mode": mode, "values": json.dumps(values),
    })
    url = f"{BASE}/{WRAPPER_NAME}?{params}"
    user_dir = tempfile.mkdtemp(prefix="mw-static-verify-")
    command = [
        CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
        "--disable-dev-shm-usage", "--disable-extensions",
        "--disable-background-networking", "--disable-component-update",
        "--disable-default-apps", "--no-first-run", "--no-default-browser-check",
        "--disable-sync",
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
        f"--user-data-dir={user_dir}",
        f"--virtual-time-budget={timeout_ms}", "--dump-dom", url,
    ]
    try:
        process = subprocess.run(
            command, capture_output=True, text=True, timeout=240,
            encoding="utf-8", errors="replace",
        )
    finally:
        wrapper_path.unlink(missing_ok=True)
    match = re.search(r'<pre id="result"[^>]*>(.*?)</pre>', process.stdout, re.S)
    if not match:
        return {"errors": [f"no result from Chrome: {process.stderr[-600:]}"]}
    payload = html.unescape(match.group(1)).strip()
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return {"errors": [f"invalid result JSON: {payload[:600]}"]}


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", nargs="+", required=True)
    parser.add_argument("--generated", nargs="+", required=True)
    parser.add_argument("--lang", required=True)
    parser.add_argument("--mode", choices=["text", "calc", "both"], default="both")
    parser.add_argument("--values", default="{}")
    parser.add_argument("--values-file", help="JSON file with input values")
    parser.add_argument("--timeout", type=int, default=18000)
    args = parser.parse_args()
    if len(args.source) != len(args.generated):
        parser.error("--source and --generated need the same number of values")
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(ROOT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    failures = 0
    try:
        time.sleep(1.0)
        for source, generated in zip(args.source, args.generated):
            values = json.loads(args.values)
            if args.values_file:
                values = json.loads((ROOT / args.values_file).read_text(encoding="utf-8"))
            result = verify(source, generated, args.lang, args.mode, values, args.timeout)
            diffs = result.get("diffs", [])
            errors = result.get("errors", [])
            status = "PASS" if not diffs and not errors else "FAIL"
            print(f"{status} {source} -> {generated} ({len(diffs)} diffs, {len(errors)} errors)")
            for item in (errors + diffs)[:25]:
                print("   " + item)
            failures += 1 if status == "FAIL" else 0
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
