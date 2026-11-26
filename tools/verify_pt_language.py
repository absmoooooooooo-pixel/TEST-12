#!/usr/bin/env python3
"""Strict Portuguese-language QA.

1. Compare every visible string in a Portuguese page with its English master.
   Anything still identical is reported unless it is an allowed engineering
   symbol, unit, standard or language name.
2. Verify the language switcher links to every language and that each target
   file exists.
3. Verify head hreflang alternates cover every language.
"""
from __future__ import annotations

import html as html_mod
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

LANGUAGES = json.loads((ROOT / "frontend" / "i18n" / "languages.json").read_text(encoding="utf-8"))
if isinstance(LANGUAGES, dict):
    LANGUAGES = LANGUAGES.get("languages", [])
CODES = [item["code"] for item in LANGUAGES]
OG_BY_CODE = {item["code"]: item.get("ogLocale", "") for item in LANGUAGES}

TOKEN_ALLOW = {
    "kg", "mm", "g", "cm", "m", "t", "l", "w", "d", "h", "a", "b", "r", "sf", "kr",
    "n", "v", "s", "k", "i", "hex", "base",
    "pcd", "od", "id", "hd", "iso", "din", "asme", "ansi", "astm", "bis", "bsi",
    "jis", "afnor", "une", "inconel", "monel", "625", "400", "javascript", "yes",
    "width", "device-width", "initial-scale", "metal", "weight", "calculator",
}
EXACT_ALLOW = {
    "Metal Weight Calculator",
    "Bronze",
    "summary",
    "website",
    "in",
    "Tf",
    "Tw",
    "f",
    "π",
    "width=device-width, initial-scale=1.0",
    "© 2026 Jadhav Group of Industries",
    "1,000,000",
    "1000",
    "0.00 kg",
    "0.00",
    "kg",
    "mm",
    "t",
}
for item in LANGUAGES:
    EXACT_ALLOW.add(item.get("name", ""))
    EXACT_ALLOW.add(item.get("nativeName", item.get("native", "")))
    EXACT_ALLOW.add(item.get("short", ""))


def normalise(value: str) -> str:
    value = html_mod.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def visible_strings(source: str) -> set[str]:
    source = re.sub(r"<script\b[\s\S]*?</script>", " ", source, flags=re.IGNORECASE)
    source = re.sub(r"<style\b[\s\S]*?</style>", " ", source, flags=re.IGNORECASE)
    source = re.sub(r"<!--[\s\S]*?-->", " ", source)
    strings: set[str] = set()
    for chunk in re.split(r"<[^>]+>", source):
        value = normalise(chunk)
        if value:
            strings.add(value)
    for match in re.finditer(r'\b(aria-label|title|placeholder|alt|content)="([^"]*)"', source, re.IGNORECASE):
        value = normalise(match.group(2))
        if value:
            strings.add(value)
    return strings


def is_allowed(value: str) -> bool:
    if value.startswith(("http://", "https://")):
        return True
    if value in EXACT_ALLOW:
        return True
    if not any(char.isalpha() for char in value):
        return True
    words = re.findall(r"[A-Za-z]+", value.lower())
    return bool(words) and all(word in TOKEN_ALLOW for word in words)


def switcher_checks(page: Path, html: str) -> list[str]:
    errors: list[str] = []
    block = re.search(r'<details class="lang-switch"[\s\S]*?</details>', html, re.IGNORECASE)
    if not block:
        return ["missing language switcher"]
    anchors = re.findall(r'<a href="([^"]+)"[^>]*hreflang="([^"]+)"[^>]*>([\s\S]*?)</a>', block.group(0), re.IGNORECASE)
    found = {code for _href, code, _body in anchors}
    if found != set(CODES):
        errors.append(f"switcher codes {sorted(found)} != {sorted(CODES)}")
    for href, code, body in anchors:
        target = (page.parent / href.split("?", 1)[0]).resolve()
        if not target.exists():
            errors.append(f"switcher {code} target missing: {href}")
        expect_og = OG_BY_CODE.get(code, "")
        if expect_og and f'data-og-locale="{expect_og}"' not in body and body not in html:
            pass
        if code == "pt" and 'aria-current="true"' not in html_mod.unescape(body):
            # aria-current sits on the <a>, so inspect the full tag via a second pass.
            tag = re.search(rf'<a href="{re.escape(href)}"[^>]*>', block.group(0), re.IGNORECASE)
            if not tag or 'aria-current="true"' not in tag.group(0):
                errors.append("pt switcher link missing aria-current")
    return errors


def hreflang_checks(page: Path, html: str) -> list[str]:
    errors: list[str] = []
    links = re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', html, re.IGNORECASE)
    codes = {code for code, _url in links}
    expected = set(CODES) | {"x-default"}
    if codes != expected:
        errors.append(f"hreflang codes {sorted(codes)} != {sorted(expected)}")
    pt_urls = [url for code, url in links if code == "pt"]
    if not pt_urls:
        errors.append("no pt hreflang")
    return errors


def main() -> None:
    try:
        import sys
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass
    pages: list[tuple[Path, Path]] = []
    for pt in sorted((ROOT / "pt" / "calculators").glob("*/index.html")):
        pages.append((pt, ROOT / "frontend" / "calculators" / pt.parent.name / "index.html"))
    pages.append((ROOT / "pt" / "index.html", ROOT / "index.html"))
    pages.append((ROOT / "pt" / "about" / "index.html", ROOT / "frontend" / "about" / "index.html"))

    failures = 0
    for pt, en in pages:
        if not pt.exists() or not en.exists():
            print(f"MISSING PAGE: {pt.relative_to(ROOT).as_posix()}")
            failures += 1
            continue
        pt_html = pt.read_text(encoding="utf-8")
        en_html = en.read_text(encoding="utf-8")
        leftovers = sorted(
            value for value in (visible_strings(pt_html) & visible_strings(en_html))
            if not is_allowed(value)
        )
        errors = []
        if leftovers:
            errors.append("English leftovers: " + " | ".join(leftovers))
        errors.extend(switcher_checks(pt, pt_html))
        errors.extend(hreflang_checks(pt, pt_html))
        if errors:
            failures += 1
            print(f"{pt.relative_to(ROOT).as_posix()}:")
            for error in errors:
                print("  - " + error)
    print(f"checked {len(pages)} pages; {failures} with findings")

    # Reverse direction: every English/other-language page must link to pt.
    reverse_failures = 0
    reverse_pages: list[Path] = []
    slugs = [path.parent.name for path in (ROOT / "pt" / "calculators").glob("*/index.html")]
    for slug in slugs:
        reverse_pages.append(ROOT / "frontend" / "calculators" / slug / "index.html")
        for code in CODES:
            if code not in ("en", "pt"):
                reverse_pages.append(ROOT / code / "calculators" / slug / "index.html")
    reverse_pages.append(ROOT / "index.html")
    reverse_pages.append(ROOT / "frontend" / "about" / "index.html")
    for code in CODES:
        if code not in ("en", "pt"):
            reverse_pages.append(ROOT / code / "index.html")
            reverse_pages.append(ROOT / code / "about" / "index.html")

    for page in reverse_pages:
        if not page.exists():
            continue
        source = page.read_text(encoding="utf-8")
        block = re.search(r'<details class="lang-switch"[\s\S]*?</details>', source, re.IGNORECASE)
        if not block:
            continue
        pt_links = re.findall(r'<a href="([^"]+)"[^>]*hreflang="pt"', block.group(0), re.IGNORECASE)
        if not pt_links:
            print(f"reverse: {page.relative_to(ROOT).as_posix()} has no pt switcher link")
            reverse_failures += 1
            continue
        target = (page.parent / pt_links[0].split("?", 1)[0]).resolve()
        if not target.exists():
            print(f"reverse: {page.relative_to(ROOT).as_posix()} pt target missing: {pt_links[0]}")
            reverse_failures += 1
    print(f"reverse-checked {len(reverse_pages)} pages; {reverse_failures} with findings")


if __name__ == "__main__":
    main()
