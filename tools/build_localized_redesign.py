#!/usr/bin/env python3
"""Rebuild and redesign every non-English page from the approved English master.

The English pages are read only. For the snapshot-generated languages the page
structure comes from the English master and the exact native strings come from
the already-reviewed localized page (its visible spans and its pre-rendered
i18n source map). Portuguese and Chinese keep their authored/reference content;
only the new presentation layer is applied to them.

    python tools/build_localized_redesign.py
    python tools/build_localized_redesign.py --lang hi --lang mr
    python tools/verify_localized_redesign.py

Every generated page loads the SAME shared calculator scripts and the SAME
calculation engine as the English master. No language has its own formula.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import posixpath
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(ROOT / "tools"))

import build_static_languages as legacy  # noqa: E402

DESIGN_VERSION = "5"
DESIGN_MARKER = "MW-LOCALIZED-PARITY"
LEGACY_MARKERS = ("MW-LOCALIZED-PARITY", "MW-LOCALIZED-REDESIGN")
DESIGN_HREF = "frontend/i18n/localized-support.css"
SHELL_START = "<!-- MW-CALC-SHELL:START -->"
SHELL_END = "<!-- MW-CALC-SHELL:END -->"
MAIN_START = "<!-- MW-CALC-MAIN:START -->"
MAIN_END = "<!-- MW-CALC-MAIN:END -->"
SIDE_START = "<!-- MW-CALC-SIDE:START -->"
SIDE_END = "<!-- MW-CALC-SIDE:END -->"
# These languages already have authored/reference pages. Their content is kept
# byte for byte; the redesign layer is added without touching their wording.
PRESERVE_LANGS = {"pt", "zh"}


def english_guard_files() -> list[Path]:
    files = [ROOT / "index.html"]
    files += sorted((ROOT / "frontend").rglob("index.html"))
    files += sorted((ROOT / "frontend/calculators").glob("*/*.js"))
    files += sorted((ROOT / "frontend/assets/js").glob("*.js"))
    return files


def fingerprint(files: list[Path]) -> dict[str, str]:
    return {
        p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in files
    }


def localized_path(source_page: str, lang: str) -> Path:
    return ROOT / legacy.target_relative_path(source_page, lang)


def resolved_meta(localized_source: str) -> dict[str, str]:
    def grab(pattern: str) -> str:
        match = re.search(pattern, localized_source, re.S)
        return html.unescape(match.group(1)).strip() if match else ""

    return {
        "title": grab(r"<title>(.*?)</title>"),
        "description": grab(r'<meta name="description" content="([^"]*)"'),
        "ogTitle": grab(r'<meta property="og:title" content="([^"]*)"'),
        "ogDescription": grab(r'<meta property="og:description" content="([^"]*)"'),
        "ogSiteName": grab(r'<meta property="og:site_name" content="([^"]*)"'),
        "twitterTitle": grab(r'<meta name="twitter:title" content="([^"]*)"'),
        "twitterDescription": grab(r'<meta name="twitter:description" content="([^"]*)"'),
        "appleTitle": grab(r'<meta name="apple-mobile-web-app-title" content="([^"]*)"'),
        "ogLocale": grab(r'<meta property="og:locale" content="([^"]*)"'),
        "switcherAria": grab(r'<summary aria-label="([^"]*)"'),
        "switcherTitle": grab(r'<summary[^>]*\btitle="([^"]*)"'),
        "switcherShort": grab(r'<span class="lang-switch__label-short">([^<]*)</span>'),
    }


def baked_source_maps(localized_source: str) -> tuple[dict[str, str], dict[str, str]]:
    """Recover the English -> localized map the runtime itself was given."""
    match = re.search(
        r'(<script type="application/json" id="mw-i18n-sources">)(.*?)(</script>)',
        localized_source,
        re.S,
    )
    if not match:
        return {}, {}
    try:
        data = json.loads(match.group(2))
    except json.JSONDecodeError:
        return {}, {}
    text = {v: k for k, v in dict(data.get("text", {})).items() if isinstance(k, str) and isinstance(v, str)}
    attrs = {v: k for k, v in dict(data.get("attrs", {})).items() if isinstance(k, str) and isinstance(v, str)}
    return text, attrs


def attribute_values(source: str) -> list[str]:
    values: list[str] = []
    for tag in re.finditer(r"<[A-Za-z][^>]*>", source, re.S):
        for attr in legacy.ATTRIBUTE_RE.finditer(tag.group(0)):
            values.append(html.unescape(attr.group(3)).strip())
    return values


def derive_maps(english_source: str, localized_source: str) -> tuple[dict[str, str], dict[str, str]] | None:
    """Pair every visible span/attribute in the two structurally identical pages."""
    english_parser = legacy.TextSpans(english_source)
    english_parser.feed(english_source)
    english_parser.close()
    localized_parser = legacy.TextSpans(localized_source)
    localized_parser.feed(localized_source)
    localized_parser.close()

    en_spans = [html.unescape(text).strip() for _, _, text in english_parser.spans]
    loc_spans = [html.unescape(text).strip() for _, _, text in localized_parser.spans]
    en_attrs = attribute_values(english_source)
    loc_attrs = attribute_values(localized_source)
    if len(en_spans) != len(loc_spans) or len(en_attrs) != len(loc_attrs):
        return None

    text_map, attr_map = baked_source_maps(localized_source)
    for en, loc in zip(en_spans, loc_spans):
        if en and loc and en != loc:
            text_map[en] = loc
    for en, loc in zip(en_attrs, loc_attrs):
        if en and loc and en != loc:
            attr_map[en] = loc
    return text_map, attr_map


def strip_design(source: str) -> str:
    """Make the injection idempotent so repeated builds stay clean."""
    for marker in LEGACY_MARKERS:
        source = re.sub(r"<!--\s*" + marker + r":.*?-->\s*\n?", "", source, count=1, flags=re.S)
    source = re.sub(
        r'^[ \t]*<link rel="stylesheet" href="[^"]*localized-(?:design|support)\.css[^"]*">\s*\n',
        "",
        source,
        count=1,
        flags=re.M,
    )
    source = re.sub(r' data-mw-(?:redesign|parity)="[^"]*"', "", source, count=1)
    return source


def unwrap_layout(source: str) -> str:
    """Undo a previous split-layout pass without losing page content."""
    shell = re.search(re.escape(SHELL_START) + r".*?" + re.escape(SHELL_END), source, re.S)
    if not shell:
        return source
    main = re.search(re.escape(MAIN_START) + r"(.*?)" + re.escape(MAIN_END), shell.group(0), re.S)
    side = re.search(re.escape(SIDE_START) + r"(.*?)" + re.escape(SIDE_END), shell.group(0), re.S)
    if not main or not side:
        return source
    restored = main.group(1).strip("\n") + "\n" + side.group(1).strip("\n")
    return source[:shell.start()] + restored + source[shell.end():]


def localize_metadata(source: str) -> str:
    """Use each page's own localized site name in social and schema metadata.

    The visible pages were already localized, but og:image:alt and the WebSite /
    Organization schema names still carried the English brand on eight of the
    nine languages. The localized og:site_name is the reviewed native name.
    """
    site = re.search(r'<meta property="og:site_name" content="([^"]*)"', source)
    if not site:
        return source
    name = html.unescape(site.group(1)).strip()
    if not name:
        return source

    source = re.sub(
        r'(<meta property="og:image:alt" content=")[^"]*(")',
        lambda match: match.group(1) + html.escape(name, quote=True) + match.group(2),
        source,
        count=1,
    )

    escaped = json.dumps(name, ensure_ascii=False)[1:-1]
    for kind in ("Organization", "WebSite"):
        source = re.sub(
            r'("@type":\s*"' + kind + r'",.*?"name":\s*")[^"]*(")',
            lambda match: match.group(1) + escaped + match.group(2),
            source,
            count=1,
            flags=re.S,
        )
    return source


def repair_portuguese(source_page: str, source: str) -> str:
    """Restore shared-script form IDs and the home canonical URL.

    The authored Portuguese pages localized element IDs (for example
    ``customDensidade``). The shared calculators still look up the English IDs,
    so those pages could not calculate with custom density or render all result
    fields. Only ID/for/aria/hash references are renamed; visible Portuguese
    words are never touched.
    """
    english = (ROOT / source_page).read_text(encoding="utf-8")
    english_ids = re.findall(r'id="([^"]+)"', english)
    portuguese_ids = re.findall(r'id="([^"]+)"', source)
    if len(english_ids) == len(portuguese_ids):
        for pt_id, en_id in zip(portuguese_ids, english_ids):
            if pt_id == en_id:
                continue
            for attribute in ("id", "for", "aria-labelledby", "aria-controls", "aria-describedby"):
                source = re.sub(
                    rf'(\b{attribute}="{re.escape(pt_id)}")',
                    f'{attribute}="{en_id}"',
                    source,
                )
            source = re.sub(rf'(href="#){re.escape(pt_id)}(")', rf'\g<1>{en_id}\2', source)

    if source_page == "index.html":
        source = source.replace(
            '<link rel="canonical" href="https://metalweightcalculator.online/">',
            '<link rel="canonical" href="https://metalweightcalculator.online/pt/">',
            1,
        )
    return source


def inject_design(source: str, page_relative: str) -> str:
    source = strip_design(source)
    marker = f"<!-- {DESIGN_MARKER}: rebuilt from the English master v{DESIGN_VERSION}; language support only -->"
    if "<!DOCTYPE html>" in source:
        source = source.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + marker, 1)
    else:
        source = marker + "\n" + source

    def add_attribute(match: re.Match[str]) -> str:
        return match.group(0)[:-1] + f' data-mw-parity="{DESIGN_VERSION}">'

    source = re.sub(r"<html\b[^>]*>", add_attribute, source, count=1)

    page_dir = posixpath.dirname(page_relative)
    href = posixpath.relpath(DESIGN_HREF, page_dir or ".")
    link = f'    <link rel="stylesheet" href="{href}?v={DESIGN_VERSION}">\n'
    if "</head>" not in source:
        raise RuntimeError(f"missing </head> in {page_relative}")
    source = source.replace("</head>", link + "</head>", 1)
    return source


def build_rebuilt_page(
    source_page: str,
    lang: str,
    languages: list[dict],
) -> str:
    """Rebuild a localized page from the English master, then restyle it."""
    english_source = (ROOT / source_page).read_text(encoding="utf-8")
    existing_path = localized_path(source_page, lang)
    if not existing_path.is_file():
        raise RuntimeError(f"missing localized reference page: {existing_path}")
    existing_source = unwrap_layout(existing_path.read_text(encoding="utf-8"))

    derived = derive_maps(english_source, existing_source)
    if derived is None:
        print(f"  [keep content] {existing_path.relative_to(ROOT).as_posix()} (structure drift)")
        return inject_design(existing_source, legacy.target_relative_path(source_page, lang))

    text_map, attr_map = derived
    # The reviewed page is the source of truth for its own wording. Dictionary
    # defaults must not replace an exact string with a generic alternative.
    original_load_dictionary = legacy.load_dictionary
    legacy.load_dictionary = lambda _lang: {"strings": {}}
    try:
        legacy.build_page(
            source_page,
            lang,
            {"languages": {lang: {"text": text_map, "attrs": attr_map, "meta": resolved_meta(existing_source)}}},
            languages,
        )
    finally:
        legacy.load_dictionary = original_load_dictionary

    generated = existing_path.read_text(encoding="utf-8")
    return inject_design(generated, legacy.target_relative_path(source_page, lang))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", action="append", help="Language code (repeatable)")
    parser.add_argument("--no-rebuild", action="store_true", help="Only restyle existing localized pages")
    args = parser.parse_args()

    languages, by_code = legacy.load_languages()
    codes = args.lang or [item["code"] for item in languages if item["code"] != "en"]
    for code in codes:
        if code not in by_code or code == "en":
            raise SystemExit(f"unknown or unsupported language: {code}")

    pages = legacy.source_pages()
    before = fingerprint(english_guard_files())
    rebuilt = preserved = 0

    for source_page in pages:
        for code in codes:
            relative = legacy.target_relative_path(source_page, code)
            target = ROOT / relative
            if not args.no_rebuild and code not in PRESERVE_LANGS and target.is_file():
                output = build_rebuilt_page(source_page, code, languages)
                rebuilt += 1
            else:
                if not target.is_file():
                    raise RuntimeError(f"missing localized page: {relative}")
                source = target.read_text(encoding="utf-8")
                if code == "pt":
                    source = repair_portuguese(source_page, source)
                output = inject_design(source, relative)
                preserved += 1
            output = unwrap_layout(output)
            output = localize_metadata(output)
            target.write_text(output, encoding="utf-8")

    after = fingerprint(english_guard_files())
    if before != after:
        changed = [key for key in before if before[key] != after.get(key)]
        raise RuntimeError(f"English master changed during build: {changed}")

    print(f"rebuilt from English master: {rebuilt} pages")
    print(f"preserved authored/reference content: {preserved} pages")
    print(f"English master untouched: {len(before)} files verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
