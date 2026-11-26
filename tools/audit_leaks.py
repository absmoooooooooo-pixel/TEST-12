#!/usr/bin/env python3
"""Report visible text that is still English on localized pages.

    python tools/audit_leaks.py [--lang ja] [--top 40]

For Devanagari, CJK and Arabic pages any Latin word that is not a unit symbol
or a standard code is a leak. Latin-script languages are checked against a list
of English words that do not occur in German, Spanish, French or Portuguese.

JSON-LD is validated separately by tools/localize_jsonld.py --check.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ALLOWED = {
    "mm", "cm", "m", "km", "kg", "g", "lb", "lbs", "mt", "ton", "tons", "t",
    "mm2", "mm3", "cm2", "cm3", "m2", "m3", "in", "inch", "inches", "ft", "yd",
    "mpa", "gpa", "ksi", "psi", "n", "kn", "kgf", "rpm", "kw", "hp", "hr", "min",
    "sec", "deg", "rad", "iso", "astm", "aisi", "sae", "din", "jis", "ansi",
    "uns", "gb", "bs", "en", "api", "ss", "hrc", "hb", "hv", "od", "id", "sf",
    "tf", "pcd", "unc", "unf", "npt", "bsp", "bsw", "bsf", "sch", "xxs", "xs",
    "std", "csv", "pdf", "xlsx", "json", "html", "http", "https", "www", "svg",
    "png", "jpg", "webp", "seo", "faq", "ui", "ux", "css", "javascript",
    "pc", "pcs", "gr", "no", "nos", "mms", "kgs", "mm4", "cm4", "in4",
    # ANSI/ASME pipe schedule designation and trigonometric function names
    "schedule", "sin", "cos", "tan", "log", "max", "min",
}

# Words that are not shared with German, Spanish, French or Portuguese.
# Only words that do not exist in German, Spanish, French or Portuguese, so a
# hit is genuinely untranslated English rather than a shared spelling.
ENGLISH_WORDS = {
    "the", "and", "with", "from", "this", "that", "these", "those", "your",
    "you", "should", "would", "could", "what", "which", "where", "when", "why",
    "are", "were", "has", "have", "into", "using", "enter", "select",
    "choose", "weight", "calculator", "density", "length", "width",
    "thickness", "quantity", "step", "steps", "example", "privacy", "steel",
    "stainless", "calculate", "calculating", "calculation", "metal", "faq",
}

NON_LATIN = {"hi", "mr", "zh", "ja", "ar"}

_LANGUAGES = json.loads(
    (ROOT / "frontend/i18n/languages.json").read_text(encoding="utf-8")
)["languages"]
LANGUAGE_NAMES = {
    item[key].lower()
    for item in _LANGUAGES
    for key in ("name", "nativeName")
    if item.get(key)
}

TOKEN = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿĀ-ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ž'’-]{2,}")

# Words spelled identically in the target language and in English.
LANGUAGE_ALLOW = {
    "de": {"aluminium", "bronze", "titan", "nickel"},
    "fr": {"aluminium", "bronze", "titane"},
}
SKIP_TAGS = {"script", "style", "noscript", "template", "head"}
TEXT_ATTRS = {"placeholder", "aria-label", "title", "alt"}


class Collector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.items: list[tuple[str, str]] = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in SKIP_TAGS:
            self.skip += 1
            return
        if self.skip:
            return
        for name, value in attrs:
            if name.lower() in TEXT_ATTRS and value:
                self.items.append((f"@{name}", value))

    def handle_endtag(self, tag):
        if tag.lower() in SKIP_TAGS and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip and data.strip():
            self.items.append(("text", data))


def collect(source: str) -> list[tuple[str, str]]:
    parser = Collector()
    parser.feed(source)
    items = list(parser.items)
    patterns = (
        (r"<title[^>]*>(.*?)</title>", "<title>"),
        (r'<meta[^>]+name="description"[^>]+content="([^"]*)"', "meta"),
        (r'<meta[^>]+property="og:[^"]+"[^>]+content="([^"]*)"', "og"),
    )
    for pattern, label in patterns:
        for match in re.finditer(pattern, source, re.S | re.I):
            items.append((label, match.group(1)))
    return items


def leaks(source: str, latin_language: bool, lang: str) -> Counter:
    found: Counter = Counter()
    allowed_words = LANGUAGE_ALLOW.get(lang, set())
    for origin, raw in collect(source):
        if "://" in raw:
            continue
        if origin == "og" and raw.strip().lower() in {"website", "article"}:
            continue
        text = re.sub(r"\s+", " ", raw)
        if text.strip().lower() in LANGUAGE_NAMES:
            continue
        words = [w.strip("'’-") for w in TOKEN.findall(text)]
        if latin_language:
            hits = [
                w for w in words
                if w.lower() in ENGLISH_WORDS and w.lower() not in allowed_words
            ]
        else:
            hits = [
                w for w in words
                if w.lower() not in ALLOWED
                and w.lower() not in LANGUAGE_NAMES
                and not (w.isupper() and 2 <= len(w) <= 6)
            ]
        for word in hits:
            found[(origin, word, text[:110])] += 1
    return found


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang")
    parser.add_argument("--top", type=int, default=40)
    args = parser.parse_args()

    languages = json.loads(
        (ROOT / "frontend/i18n/languages.json").read_text(encoding="utf-8")
    )["languages"]
    codes = [item["code"] for item in languages if item["code"] != "en"]
    if args.lang:
        codes = [args.lang]

    for code in codes:
        totals: Counter = Counter()
        pages: dict[tuple[str, str, str], str] = {}
        for page in sorted((ROOT / code).glob("**/index.html")):
            source = page.read_text(encoding="utf-8")
            for key, count in leaks(source, code not in NON_LATIN, code).items():
                totals[key] += count
                pages.setdefault(key, page.relative_to(ROOT).as_posix())
        print(f"\n[{code}] {len(totals)} leak(s)")
        for (origin, word, context), count in totals.most_common(args.top):
            print(f"  {count:>4}  {origin:<9} {word:<16} {pages[(origin, word, context)]}")
            print(f"        {context}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
