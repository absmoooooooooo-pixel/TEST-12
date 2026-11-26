#!/usr/bin/env python3
"""Verify the rebuilt localized site without changing any page.

    python tools/verify_localized_redesign.py
    python tools/verify_localized_redesign.py --calc

Checks: every non-English page carries the redesign marker and stylesheet,
declares the right language/direction, keeps the shared calculation engine and
the English page's form IDs, has canonical + hreflang metadata, and contains no
visible English sentence. Optionally runs the shared engine with sample inputs.
"""
from __future__ import annotations

import argparse
import json
import posixpath
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(ROOT / "tools"))

import audit_untranslated  # noqa: E402
import build_static_languages as legacy  # noqa: E402

DESIGN_MARKER = "MW-LOCALIZED-PARITY"
DESIGN_VERSION = "5"
DESIGN_FILE = "localized-support.css"


def ids(source: str) -> set[str]:
    return set(re.findall(r'id="([^"]+)"', source))


def assets(source: str) -> tuple[set[str], set[str]]:
    """Stylesheets and scripts a page loads, reduced to their file names.

    A localized page may only add the language-support stylesheet and the
    static dictionary; every other asset has to be the English master's.
    """
    def norm(url: str) -> str:
        return posixpath.basename(url.split("?")[0])

    css = {
        norm(href)
        for href in re.findall(r'<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"', source)
    }
    js = {norm(src) for src in re.findall(r'<script\b[^>]*src="([^"]+)"', source)}
    return css, js


def structure(source: str) -> tuple[list[str], list[str]]:
    """The page's skeleton: every section tag and every card class, in order.

    English is the master, so a localized page must produce exactly this list.
    Text is not part of it, which is what lets translations differ while the
    design stays identical.
    """
    def norm(tag: str) -> str:
        return re.sub(r"\s+", " ", tag).strip()

    sections = [norm(tag) for tag in re.findall(r"<section[^>]*>", source)]
    cards = re.findall(r'<div class="([^"]*field-card[^"]*|[^"]*card[^"]*)"', source)
    return sections, cards


def check_calculation() -> str:
    script = r"""
require('./frontend/assets/js/calc-engine.js');
var engine = globalThis.MWCalcEngine;
var samples = [
  ['plate', {values:{width:1000,thickness:5,length:2000},unit:'mm',density:7.85,quantity:3}, 235.5],
  ['round-bar', {values:{diameter:100,length:1000},unit:'mm',density:7.85,quantity:1}, 61.65375582669969]
];
var lines = [];
samples.forEach(function (s) {
  var out = engine.calculate(s[0], s[1]);
  var weight = out.totalWeight;
  if (typeof weight !== 'number' || Math.abs(weight - s[2]) > 1e-6) {
    throw new Error(s[0] + ' expected ' + s[2] + ', got ' + weight);
  }
  lines.push(s[0] + '=' + weight);
});
console.log(lines.join(' '));
"""
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, capture_output=True, text=True,
        encoding="utf-8", errors="replace", timeout=120,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or "calculation check failed")
    return result.stdout.strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--calc", action="store_true")
    args = parser.parse_args()

    languages, by_code = legacy.load_languages()
    problems: list[str] = []
    pages_checked = 0
    calc_pages = 0

    design_css = ROOT / "frontend/i18n/localized-support.css"
    if not design_css.is_file():
        problems.append("missing frontend/i18n/localized-support.css")
    else:
        css = design_css.read_text(encoding="utf-8")
        for token in ('lang="hi"', 'lang="mr"', 'lang="ar"', 'lang="ja"', 'lang="zh"', '[dir="rtl"]'):
            if token not in css:
                problems.append(f"design stylesheet missing {token}")

    for source_page in legacy.source_pages():
        english = (ROOT / source_page).read_text(encoding="utf-8")
        english_ids = ids(english)
        is_calc = "/calculators/" in source_page
        for info in languages:
            code = info["code"]
            if code == "en":
                continue
            relative = legacy.target_relative_path(source_page, code)
            path = ROOT / relative
            if not path.is_file():
                problems.append(f"missing {relative}")
                continue
            source = path.read_text(encoding="utf-8")
            pages_checked += 1

            if DESIGN_MARKER not in source:
                problems.append(f"{relative}: missing redesign marker")
            expected_link = posixpath.relpath("frontend/i18n/" + DESIGN_FILE, posixpath.dirname(relative) or ".")
            if f'href="{expected_link}?v={DESIGN_VERSION}"' not in source:
                problems.append(f"{relative}: missing/incorrect design stylesheet link")
            if f'data-mw-parity="{DESIGN_VERSION}"' not in source:
                problems.append(f"{relative}: missing parity attribute")

            direction = info.get("dir", "ltr")
            if not re.search(rf'<html\b[^>]*\blang="{code}"', source):
                problems.append(f"{relative}: wrong html lang")
            if not re.search(rf'<html\b[^>]*\bdir="{direction}"', source):
                problems.append(f"{relative}: wrong html direction")
            if f'rel="canonical" href="https://metalweightcalculator.online/{code}/' not in source:
                problems.append(f"{relative}: wrong canonical URL")
            if source.count('rel="alternate" hreflang=') < len(languages):
                problems.append(f"{relative}: incomplete hreflang set")
            if not all(f'hreflang="{item["code"]}"' in source for item in languages):
                problems.append(f"{relative}: missing language alternate")
            site_name = re.search(r'<meta property="og:site_name" content="([^"]*)"', source)
            image_alt = re.search(r'<meta property="og:image:alt" content="([^"]*)"', source)
            if site_name and image_alt and site_name.group(1) != image_alt.group(1):
                problems.append(f"{relative}: og:image:alt is not the localized site name")
            if is_calc:
                calc_pages += 1
                if "calc-engine.js" not in source:
                    problems.append(f"{relative}: calculation engine not linked")
                if "mw-calc-shell" in source or "mw-calc-side" in source:
                    problems.append(f"{relative}: still carries the old split layout")
                if structure(source) != structure(english):
                    problems.append(f"{relative}: section/card structure differs from the English master")
                if "localized-design.css" in source:
                    problems.append(f"{relative}: old design override still linked")
                missing_ids = sorted(english_ids - ids(source))
                if missing_ids:
                    problems.append(f"{relative}: missing form IDs {missing_ids[:5]}")
            elif "mw-calc-shell" in source or "mw-calc-side" in source:
                problems.append(f"{relative}: split workspace leaked into a non-calculator page")
            if structure(source) != structure(english):
                problems.append(f"{relative}: section/card structure differs from the English master")

            english_css, english_js = assets(english)
            local_css, local_js = assets(source)
            extra_css = local_css - english_css - {DESIGN_FILE}
            missing_css = english_css - local_css
            if extra_css:
                problems.append(f"{relative}: extra stylesheet {sorted(extra_css)[:3]}")
            if missing_css:
                problems.append(f"{relative}: missing master stylesheet {sorted(missing_css)[:3]}")
            if local_js - english_js - {
                f"dict-{code}.js",
                "i18n-static.js",
                # The static build swaps the runtime dashboard/switcher for their
                # pre-rendered equivalents; the feature is the same.
                "dashboard-static.js",
            }:
                problems.append(f"{relative}: extra script {sorted(local_js - english_js)[:3]}")
            if english_js - local_js - {"i18n.js", "dashboard.js", "language-switcher.js"}:
                problems.append(f"{relative}: missing master script {sorted(english_js - local_js)[:3]}")

            found = audit_untranslated.candidates(audit_untranslated.visible_text(source))
            if found:
                problems.append(f"{relative}: visible English candidates {list(found)[:3]}")

    # English pages must never receive the localized presentation layer.
    english_pages = [ROOT / "index.html"] + sorted((ROOT / "frontend").rglob("index.html"))
    for page in english_pages:
        source = page.read_text(encoding="utf-8")
        if DESIGN_MARKER in source or "data-mw-parity" in source or "data-mw-redesign" in source:
            problems.append(f"{page.relative_to(ROOT).as_posix()}: English master was modified")

    print(f"checked {pages_checked} localized pages ({calc_pages} calculators, {len(languages) - 1} languages)")
    print(f"English master pages checked: {len(english_pages)}")
    if args.calc:
        print("shared engine samples: " + check_calculation())
    if problems:
        print(f"FAIL: {len(problems)} problems")
        for problem in problems[:40]:
            print("  " + problem)
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
