#!/usr/bin/env python3
"""Audit visible English text remaining on generated language pages.

    python tools/audit_untranslated.py [--lang ja] [--top 80]

The report is a review aid: official standard codes, grade numbers, trademarks
and universally used unit symbols stay unchanged by design.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_TAGS = {"script", "style", "noscript", "template", "head", "svg:title"}
TEXT_ATTRS = {"placeholder", "aria-label", "title", "alt", "value"}
TOKEN_RE = re.compile(r"[^\W\d_]+(?:[&'-][^\W\d_]+)*", re.UNICODE)

# Official identifiers, units, file formats and internationally fixed terms.
KEEP = {
    "astm", "aisi", "sae", "din", "jis", "iso", "ansi", "bs", "en", "gb", "uns",
    "ss", "astma", "astm", "jisg", "ding", "en", "grade", "gr", "type", "class",
    "mm", "cm", "km", "kg", "lb", "lbs", "mt", "ton", "tons", "mpa", "gpa", "ksi",
    "psi", "n", "kn", "kgf", "gf", "mm2", "cm2", "m2", "mm3", "cm3", "m3", "in",
    "inch", "inches", "ft", "feet", "yd", "m", "deg", "rad", "hr", "min", "sec",
    "html", "http", "https", "www", "url", "api", "csv", "pdf", "xlsx", "json",
    "javascript", "css", "svg", "png", "jpg", "jpeg", "webp", "id", "od", "pc",
    "pcd", "sf", "tf", "tw", "h", "r", "t", "a", "b", "c", "d", "e", "f", "g",
    "i", "j", "k", "l", "m", "n", "o", "p", "q", "s", "u", "v", "w", "x", "y", "z",
    "kgcm", "kgm", "nm", "rpm", "kw", "hp", "v", "a", "dc", "ac", "led", "usb",
    "seo", "pwa", "faq", "ui", "ux", "qa", "ce", "rohs", "reach", "msds", "ppm",
    "hrc", "hb", "hv", "ra", "rms", "wt", "max", "min", "avg", "pdfs",
    "ismc", "frustum", "schedule", "unc", "unf", "npt", "bsp", "bsw", "bsf",
}

# English function words are a reliable signal that a whole visible string is
# still English. Official codes and single vocabulary terms are handled by KEEP
# rather than by this list.
STOPWORDS = {
    "the", "and", "of", "with", "from", "this", "that", "these", "those",
    "every", "still", "will", "would", "should", "does", "what", "which",
    "who", "how", "why", "when", "where", "your",
}

_languages = json.loads((ROOT / "frontend/i18n/languages.json").read_text(encoding="utf-8"))["languages"]
NATIVE_NAMES = {item["nativeName"].lower() for item in _languages}
NATIVE_NAMES |= {item["name"].lower() for item in _languages}


class VisibleText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.stack: list[str] = []
        self.skip_tags: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if self.skip_tags:
            return
        if tag in SKIP_TAGS:
            self.skip_tags.append(tag)
            return
        self.stack.append(tag)
        for name, value in attrs:
            name = name.lower()
            if name in TEXT_ATTRS and value:
                if name == "value" and tag == "option":
                    continue
                self.parts.append(value)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self.skip_tags:
            return
        for name, value in attrs:
            name = name.lower()
            if name in TEXT_ATTRS and value:
                if name == "value" and tag.lower() == "option":
                    continue
                self.parts.append(value)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self.skip_tags:
            if tag == self.skip_tags[-1]:
                self.skip_tags.pop()
            return
        if tag in self.stack:
            while self.stack:
                if self.stack.pop() == tag:
                    break

    def handle_data(self, data: str) -> None:
        if not self.skip_tags and data.strip():
            self.parts.append(data)


def visible_text(source: str) -> str:
    parser = VisibleText()
    parser.feed(source)
    return "\n".join(parser.parts)


def candidates(text: str) -> Counter[str]:
    """Report visible strings that still read as English phrases.

    Native language names in the switcher and preserved official identifiers
    are ignored; a string is reported only when it contains English function
    words alongside other meaningful vocabulary.
    """
    found: Counter[str] = Counter()
    for line in text.splitlines():
        phrase = re.sub(r"\s+", " ", line).strip()
        if len(phrase) < 5:
            continue
        tokens = [token.lower().strip("&-'") for token in TOKEN_RE.findall(phrase)]
        meaningful = [
            token for token in tokens
            if len(token) >= 3 and token not in KEEP and token not in NATIVE_NAMES
        ]
        if len(meaningful) < 2 or not any(token in STOPWORDS for token in meaningful):
            continue
        found[phrase] += 1
    return found


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", help="Only audit one language code")
    parser.add_argument("--top", type=int, default=100)
    args = parser.parse_args()

    languages = json.loads((ROOT / "frontend/i18n/languages.json").read_text(encoding="utf-8"))["languages"]
    codes = [item["code"] for item in languages if item["code"] != "en"]
    if args.lang:
        codes = [args.lang]

    per_language: dict[str, Counter[str]] = defaultdict(Counter)
    page_counts: dict[str, int] = defaultdict(int)
    examples: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    total_pages = 0

    for code in codes:
        for page in sorted((ROOT / code).glob("**/index.html")):
            rel = page.relative_to(ROOT).as_posix()
            text = visible_text(page.read_text(encoding="utf-8"))
            found = candidates(text)
            if found:
                page_counts[code] += 1
            total_pages += 1
            for word, count in found.items():
                per_language[code][word] += count
                if len(examples[code][word]) < 3:
                    examples[code][word].append(rel)

    print(f"audited {total_pages} language pages across {len(codes)} languages")
    for code in codes:
        words = per_language[code]
        print(f"\n[{code}] {page_counts[code]} pages with candidates, {len(words)} unique words")
        for word, count in words.most_common(args.top):
            sample = ", ".join(examples[code][word][:2])
            print(f"  {word:<28} {count:>5}  {sample}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
