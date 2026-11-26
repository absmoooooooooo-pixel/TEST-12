#!/usr/bin/env python3
"""Rebuild the JSON-LD blocks of localized pages from their own content.

    python tools/localize_jsonld.py            # report only
    python tools/localize_jsonld.py --write    # rewrite pages
    python tools/localize_jsonld.py --check    # exit 1 if anything is left over

Every non-English page carries a copy of the English schema graph: English
WebApplication name/description, "Requires JavaScript", the /frontend/ URL and
an English breadcrumb ("Home", "Plate Weight Calculator"). This tool points the
URLs at the page's own canonical and takes name/description from the localized
<h1> and meta description, so the structured data matches the visible page.

Only non-English pages are touched; the approved English master is ignored.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANGS = ("hi", "mr", "zh", "ja", "ar", "de", "es", "fr", "pt")
SITE = "https://metalweightcalculator.online"

BROWSER_REQUIREMENTS = {
    "hi": "JavaScript आवश्यक है",
    "mr": "JavaScript आवश्यक आहे",
    "zh": "需要 JavaScript",
    "ja": "JavaScript が必要です",
    "ar": "يتطلب JavaScript",
    "de": "JavaScript erforderlich",
    "es": "Requiere JavaScript",
    "fr": "JavaScript requis",
    "pt": "Requer JavaScript",
}

DEFAULT_HOME = {
    "hi": "होम",
    "mr": "मुख्यपृष्ठ",
    "zh": "首页",
    "ja": "ホーム",
    "ar": "الرئيسية",
    "de": "Startseite",
    "es": "Inicio",
    "fr": "Accueil",
    "pt": "Início",
}

LD_BLOCK = re.compile(
    r'(<script type="application/ld\+json">)(.*?)(</script>)', re.S
)
TAG = re.compile(r"<[^>]+>")


def text_of(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(TAG.sub(" ", fragment))).strip()


def first_match(pattern: str, source: str) -> str | None:
    match = re.search(pattern, source, re.S | re.I)
    return match.group(1).strip() if match else None


def home_label(lang: str) -> str:
    path = ROOT / "frontend/i18n" / lang / f"{lang}.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return DEFAULT_HOME[lang]
    strings = data.get("strings") or {}
    for key, value in strings.items():
        if key.strip().lower() == "home" and isinstance(value, str) and value.strip():
            return value.strip()
    return DEFAULT_HOME[lang]


def page_facts(source: str, lang: str) -> dict[str, str]:
    canonical = first_match(r'<link rel="canonical" href="([^"]+)"', source) or ""
    h1 = first_match(r"<h1[^>]*>(.*?)</h1>", source) or ""
    title = first_match(r"<title[^>]*>(.*?)</title>", source) or ""
    description = first_match(
        r'<meta[^>]+name="description"[^>]+content="([^"]*)"', source
    ) or ""
    return {
        "canonical": canonical.rstrip("/") + "/" if canonical else "",
        "h1": text_of(h1),
        "title": text_of(title),
        "description": html.unescape(description).strip(),
        "home": home_label(lang),
        "home_url": f"{SITE}/{lang}/",
        "lang": lang,
    }


def localize_node(node: dict, facts: dict[str, str], is_about: bool) -> None:
    kind = node.get("@type")
    if kind == "WebApplication":
        node["@id"] = f"{facts['canonical']}#webapp"
        node["url"] = facts["canonical"]
        node["name"] = facts["h1"] or node.get("name", "")
        if facts["description"]:
            node["description"] = facts["description"]
        node["browserRequirements"] = BROWSER_REQUIREMENTS[facts["lang"]]
        node["inLanguage"] = facts["lang"]
    elif kind == "AboutPage":
        node["@id"] = f"{facts['canonical']}#webpage"
        node["url"] = facts["canonical"]
        node["name"] = facts["title"] or node.get("name", "")
        if facts["description"]:
            node["description"] = facts["description"]
        node["inLanguage"] = facts["lang"]
    elif kind == "BreadcrumbList":
        node["@id"] = f"{facts['canonical']}#breadcrumb"
        items = node.get("itemListElement") or []
        if items:
            items[0]["name"] = facts["home"]
            items[0]["item"] = facts["home_url"]
        if len(items) > 1:
            items[1]["name"] = facts["title"] if is_about else (facts["h1"] or facts["title"])
            items[1]["item"] = facts["canonical"]
    elif kind == "WebSite":
        node["inLanguage"] = facts["lang"]


def rewrite(source: str, lang: str, is_about: bool) -> tuple[str, int]:
    facts = page_facts(source, lang)
    if not facts["canonical"]:
        return source, 0

    def replace(match: re.Match[str]) -> str:
        try:
            data = json.loads(match.group(2))
        except json.JSONDecodeError:
            return match.group(0)
        graph = data.get("@graph")
        if isinstance(graph, list):
            for node in graph:
                if isinstance(node, dict):
                    localize_node(node, facts, is_about)
        else:
            localize_node(data, facts, is_about)
        return match.group(1) + "\n" + json.dumps(data, indent=2, ensure_ascii=False) + "\n" + match.group(3)

    new_source, count = LD_BLOCK.subn(replace, source)
    return new_source, count


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    problems: list[str] = []
    changed = 0
    for lang in LANGS:
        for path in sorted((ROOT / lang).glob("**/index.html")):
            rel = path.relative_to(ROOT).as_posix()
            with path.open("r", encoding="utf-8", newline="") as handle:
                source = handle.read()
            is_about = "/about/" in f"/{rel}"
            new_source, blocks = rewrite(source, lang, is_about)
            if blocks == 0:
                continue
            if args.check:
                if new_source.replace("\r\n", "\n") != source.replace("\r\n", "\n"):
                    problems.append(rel)
                continue
            if new_source == source:
                continue
            changed += 1
            if args.write:
                crlf = "\r\n" in source
                if crlf:
                    new_source = new_source.replace("\r\n", "\n").replace("\n", "\r\n")
                with path.open("w", encoding="utf-8", newline="") as handle:
                    handle.write(new_source)

    if args.check:
        print(f"{len(problems)} page(s) still carry English schema data")
        for rel in problems[:60]:
            print(f"  {rel}")
        return 1 if problems else 0

    action = "updated" if args.write else "would update"
    print(f"{action}: {changed} page(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
