#!/usr/bin/env python3
"""Centralize technical terminology in every language dictionary.

This script is idempotent. It:

* adds a `technical` section used by the runtime drawing module;
* makes sure every unit name/description in the dictionaries uses the shared
  unit terminology; and
* translates formula, example and calculation-step strings that contain
  dimension symbols, using the same native symbol as the drawings.

Run it before tools/build_i18n.py.
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import i18n_paths as paths
import technical_i18n_data as data

ROOT = paths.PROJECT_ROOT
I18N_DIR = paths.I18N_DIR
TEXT_RE = re.compile(r">([^<]+)<")
ATTR_RE = re.compile(
    r'\b(?:placeholder|aria-label|title|alt)="([^"]*)"'
)


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def english_source_pages() -> dict[str, str]:
    """Map every English calculator string to the page that owns it.

    Text nodes and the four translated attributes are both included so field
    labels such as ``Length (L)`` localize with the same symbol as the drawing.
    """
    mapping: dict[str, str] = {}
    for page in sorted((ROOT / "frontend" / "calculators").glob("*/index.html")):
        slug = page.parent.name
        document = page.read_text(encoding="utf-8")
        for pattern in (TEXT_RE, ATTR_RE):
            for raw in pattern.findall(document):
                text = clean(raw)
                if text:
                    mapping.setdefault(text, slug)
    return mapping


def localized(text: str, tokens: dict[str, str], symbols: dict[str, str]) -> str:
    """Replace English dimension tokens with the native technical symbol."""
    if not text or not tokens or not symbols:
        return text

    result = text
    ordered = sorted(tokens.items(), key=lambda item: len(item[0]), reverse=True)
    for token, semantic in ordered:
        symbol = symbols.get(semantic)
        if not symbol or symbol == token:
            continue
        pattern = re.compile(
            r"(?<![A-Za-z0-9ρ])" + re.escape(token) + r"(?![A-Za-z0-9ρ])"
        )
        result = pattern.sub(symbol, result)

    # "W = Weight (kg)" becomes "重量 = 重量 (kg)" once the symbol is
    # localized.  Drop the duplicated definition while keeping the symbol.
    result = re.sub(r"(\S+)\s*=\s*\1(?=\s|$)", r"\1", result)
    result = re.sub(r"(\S+)\s*\(\s*\1\s*\)", r"\1", result)
    return result


def update_dictionary(code: str, sources: dict[str, str]) -> None:
    path = I18N_DIR / (code + ".json")
    dictionary = json.loads(path.read_text(encoding="utf-8"))
    units = data.UNITS.get(code, data.UNITS["en"])
    symbols = data.SYMBOLS.get(code, {})

    dictionary["technical"] = data.technical_payload(code)

    for key, value in data.UNIT_DICTIONARY_KEYS.items():
        dictionary.setdefault("strings", {})[key] = value(units)

    for section in ("terms", "strings", "templates"):
        bucket = dictionary.setdefault(section, {})
        for source, translated in list(bucket.items()):
            page = sources.get(source)
            if not page:
                continue
            tokens = data.PAGE_TOKENS.get(page, {})
            if re.match(r"^[A-Za-z][A-Za-z ]* \([A-Za-zρ]+\)$", source) and any(
                token in tokens for token in re.findall(r"\(([A-Za-zρ]+)\)", source)
            ):
                # Short field labels must carry the drawing symbol itself, not a
                # translated synonym that happens to sit in parentheses.
                match = re.match(r"^(.*?)\s*\([^)]*\)$", translated)
                name = re.sub(r"\s*\([^)]*\)$", "", source)
                prefix = dictionary.get("terms", {}).get(name)
                if not prefix:
                    prefix = match.group(1) if match else translated
                source_token = re.findall(r"\(([A-Za-zρ]+)\)", source)[0]
                symbol = localized(source_token, tokens, symbols)
                bucket[source] = prefix if prefix == symbol else prefix + " (" + symbol + ")"
                continue
            result = localized(translated, tokens, symbols)
            if result != translated:
                bucket[source] = result

    strings = dictionary.setdefault("strings", {})
    for source, page in sources.items():
        if source in strings:
            continue
        strings[source] = localized(
            source, data.PAGE_TOKENS.get(page, {}), symbols
        )

    path.write_text(
        json.dumps(dictionary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def main() -> None:
    sources = english_source_pages()
    for code in data.LANGUAGES:
        update_dictionary(code, sources)
    print(f"technical dictionaries updated: {len(data.LANGUAGES)}")
    print(f"technical source strings: {len(sources)}")


if __name__ == "__main__":
    main()
