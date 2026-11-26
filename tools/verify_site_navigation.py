#!/usr/bin/env python3
"""Verify every page's direct URL and language navigation targets.

    python tools/verify_site_navigation.py

Checks all 260 website pages over HTTP (status, final URL, html lang/dir,
switcher links and hreflang alternates), confirms missing routes are 404, and
runs tools/verify_runtime_switcher.js for the English runtime switcher.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("MW_NAV_PORT", "8792"))
BASE = f"http://127.0.0.1:{PORT}"
CHROME_404 = "/this-route-must-not-exist/"


def source_pages() -> list[str]:
    pages = ["index.html", "frontend/about/index.html"]
    pages.extend(
        str(path.relative_to(ROOT)).replace("\\", "/")
        for path in sorted((ROOT / "frontend" / "calculators").glob("*/index.html"))
    )
    return pages


# Links name the HTML file itself. A folder URL only works on a server that
# resolves directories to index.html; opened from disk it shows a listing.
def english_url(source_page: str) -> str:
    if source_page == "index.html":
        return "/index.html"
    return "/" + source_page


def language_url(source_page: str, code: str) -> str:
    if source_page == "index.html":
        return f"/{code}/index.html"
    if source_page == "frontend/about/index.html":
        return f"/{code}/about/index.html"
    slug = source_page.split("/")[-2]
    return f"/{code}/calculators/{slug}/index.html"


def local_file(url_path: str) -> Path:
    decoded = urllib.parse.unquote(url_path)
    if decoded in {"", "/"}:
        return ROOT / "index.html"
    target = ROOT / decoded.lstrip("/")
    if target.is_dir():
        target = target / "index.html"
    return target


def resolve_href(current_url: str, href: str) -> str:
    if href == "#":
        return "#"
    path = urllib.parse.urlparse(urllib.parse.urljoin(current_url, href)).path
    # Clean folder URLs are valid on a static host. Compare them with the
    # equivalent index.html file that the host serves for that folder.
    if path.endswith("/") and local_file(path).exists():
        return path + "index.html"
    return path


def switcher_links(html: str) -> dict[str, str]:
    menu_match = re.search(r'<ul\b[^>]*class="[^"]*lang-switch__menu[^"]*"[^>]*>(.*?)</ul>', html, re.S | re.I)
    if not menu_match:
        return {}
    links = {}
    for tag in re.findall(r"<a\b[^>]*>", menu_match.group(1), re.I):
        code = re.search(r'\bhreflang="([^"]+)"', tag, re.I)
        href = re.search(r'\bhref="([^"]+)"', tag, re.I)
        if code and href:
            links[code.group(1)] = href.group(1)
    return links


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    languages = json.loads((ROOT / "frontend" / "i18n" / "languages.json").read_text(encoding="utf-8"))["languages"]
    codes = [item["code"] for item in languages]
    pages = source_pages()
    records = []

    for source in pages:
        for from_code in codes:
            from_url = english_url(source) if from_code == "en" else language_url(source, from_code)
            expected = {}
            for code in codes:
                target = english_url(source) if code == "en" else language_url(source, code)
                if not local_file(target).exists():
                    target = f"/{code}/"
                expected[code] = target
            records.append({
                "from": from_url,
                "from_lang": from_code,
                "source": source,
                "expected": expected,
            })

    problems: list[str] = []
    checked_hrefs = 0
    checked_alternates = 0

    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(ROOT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        time.sleep(1.0)
        for record in records:
            url = BASE + record["from"]
            try:
                with urllib.request.urlopen(url, timeout=30) as response:
                    final_url = urllib.parse.urlparse(response.geturl()).path
                    html = response.read().decode("utf-8", errors="replace")
                    status = response.status
            except urllib.error.HTTPError as error:
                problems.append(f"{record['from']}: HTTP {error.code}")
                continue
            except Exception as error:
                problems.append(f"{record['from']}: request failed: {error}")
                continue

            label = record["from"]
            if status != 200:
                problems.append(f"{label}: status {status}")
            if final_url != record["from"]:
                problems.append(f"{label}: redirected to {final_url}")

            lang_match = re.search(r'<html\b[^>]*\blang="([^"]+)"', html, re.I)
            dir_match = re.search(r'<html\b[^>]*\bdir="([^"]+)"', html, re.I)
            actual_lang = lang_match.group(1) if lang_match else None
            actual_dir = dir_match.group(1) if dir_match else None
            if actual_lang != record["from_lang"]:
                problems.append(f"{label}: html lang {actual_lang} != {record['from_lang']}")
            expected_dir = "rtl" if record["from_lang"] == "ar" else "ltr"
            if actual_dir != expected_dir:
                problems.append(f"{label}: dir {actual_dir} != {expected_dir}")

            links = switcher_links(html)
            if set(links) != set(codes):
                problems.append(f"{label}: switcher codes {sorted(links)} != {sorted(codes)}")

            for code in codes:
                expected = record["expected"][code]
                href = links.get(code)
                if href is None:
                    continue
                checked_hrefs += 1
                if record["from_lang"] == "en":
                    # English links are generated at runtime and verified by
                    # tools/verify_runtime_switcher.js.
                    continue
                actual = resolve_href(BASE + record["from"], href)
                if actual != expected:
                    problems.append(f"{label}: {code} href {actual} != {expected}")

                target_url = BASE + expected
                try:
                    with urllib.request.urlopen(target_url, timeout=30) as target_response:
                        target_html = target_response.read(4096).decode("utf-8", errors="replace")
                        target_lang = re.search(r'<html\b[^>]*\blang="([^"]+)"', target_html, re.I)
                        target_lang = target_lang.group(1) if target_lang else None
                    if target_lang != code:
                        problems.append(f"{label}: {code} target lang {target_lang} != {code}")
                except Exception as error:
                    problems.append(f"{label}: {code} target {expected} failed: {error}")

            alternates = re.findall(r'<link\b[^>]*\brel="alternate"[^>]*\bhreflang="([^"]+)"', html, re.I)
            expected_alternates = set(codes) | {"x-default"}
            if set(alternates) != expected_alternates:
                problems.append(f"{label}: hreflang codes {sorted(set(alternates))} != {sorted(expected_alternates)}")
            if len(alternates) != len(expected_alternates):
                problems.append(f"{label}: {len(alternates)} hreflang tags, expected {len(expected_alternates)}")
            checked_alternates += len(alternates)

        for missing in ("/en/", "/xx/", "/hi/plate-weight-calculator/", CHROME_404):
            try:
                urllib.request.urlopen(BASE + missing, timeout=10)
                problems.append(f"missing route {missing}: unexpectedly succeeded")
            except urllib.error.HTTPError as error:
                if error.code != 404:
                    problems.append(f"missing route {missing}: HTTP {error.code}, expected 404")
            except Exception as error:
                problems.append(f"missing route {missing}: {error}")
    finally:
        server.terminate()
        server.wait(timeout=5)

    node_result = subprocess.run(
        ["node", str(ROOT / "tools" / "verify_runtime_switcher.js")],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    print(node_result.stdout.strip())
    if node_result.returncode:
        print(node_result.stderr.strip())

    print(f"checked {len(records)} direct page loads, {checked_hrefs} static switcher hrefs, "
          f"{checked_alternates} hreflang alternates, {len(problems)} problems")
    for problem in problems[:200]:
        print("  " + problem)
    return 1 if problems or node_result.returncode else 0


if __name__ == "__main__":
    raise SystemExit(main())
